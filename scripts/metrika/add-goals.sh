#!/bin/bash

# Yandex Metrika Goal Creation Script
# This script creates goals of type 'action' for multiple Yandex Metrika counters
# It checks if goals already exist before creating them

# Configuration - adjust these paths as needed
COUNTERS_FILE="./counters.json"
GOALS_FILE="./goals.json"

# Access token - set via environment variable
ACCESS_TOKEN="${YANDEX_METRIKA_TOKEN}"

# Check if token is provided
if [ -z "$ACCESS_TOKEN" ]; then
    echo "Error: Yandex Metrika OAuth token is required"
    echo "Set it as an environment variable: export YANDEX_METRIKA_TOKEN=your_token"
    exit 1
fi

# Check if required files exist
if [ ! -f "$COUNTERS_FILE" ]; then
    echo "Error: Counters file not found at $COUNTERS_FILE"
    exit 1
fi

if [ ! -f "$GOALS_FILE" ]; then
    echo "Error: Goals file not found at $GOALS_FILE"
    exit 1
fi

# Create temporary files to store results
TEMP_DIR=$(mktemp -d)
RESULTS_FILE="${TEMP_DIR}/results.txt"
SUMMARY_FILE="${TEMP_DIR}/summary.txt"

# Clean up temporary files on exit
trap 'rm -rf "$TEMP_DIR"' EXIT

# Function to fetch existing goals for a counter
fetch_existing_goals() {
    local counter_id=$1
    
    echo "🔍 Fetching existing goals for counter $counter_id..."
    
    response=$(curl -s -X GET \
        -H "Authorization: OAuth $ACCESS_TOKEN" \
        -H "Content-Type: application/x-yametrika+json" \
        "https://api-metrika.yandex.net/management/v1/counter/$counter_id?pretty=1&field=goals")
    
    # Check for errors in response
    if echo "$response" | grep -q "\"errors\""; then
        echo "❌ Failed to fetch goals for counter $counter_id"
        echo "Error details:"
        echo "-------------------------------------------------------------"
        echo "Full API Response:"
        echo "$response"
        echo "-------------------------------------------------------------"
        echo "HTTP Status: $(echo "$response" | grep -o '"code":[0-9]*' | cut -d':' -f2 || echo "Unknown")"
        echo "Error message: $(echo "$response" | grep -o '"message":"[^"]*"' | cut -d':' -f2- | tr -d '"' || echo "No detailed message")"
        
        echo "{}" # Return empty JSON object
    else
        echo "$response"
    fi
}

# Function to check if a goal already exists - fixed to properly handle not found case
goal_exists() {
    local counter_id=$1
    local goal_name=$2
    local condition_url=$3
    local counter_goals_json=$4
    
    # Save the full response to a file for easier processing
    local debug_file="${TEMP_DIR}/counter_${counter_id}_goals.json"
    echo "$counter_goals_json" > "$debug_file"
    
    # Direct grep approach - avoid any jq parsing issues
    # Redirect debug messages to stderr so they don't get captured in command substitution
    echo "Looking for URL '$condition_url' in counter $counter_id..." >&2
    
    # Simple string-based search for the URL in the JSON
    if grep -q "\"url\":\"$condition_url\"" "$debug_file"; then
        echo "Found URL match for condition: $condition_url" >&2
        
        # Extract the surrounding context to find the goal ID
        local section=$(grep -B 30 -A 5 "\"url\":\"$condition_url\"" "$debug_file")
        local goal_id=$(echo "$section" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
        
        if [ -n "$goal_id" ]; then
            echo "Found goal ID $goal_id with matching URL $condition_url" >&2
            echo "$goal_id"
            return 0
        fi
    fi
    
    # If URL search fails, try name match as fallback
    if grep -q "\"name\":\"$goal_name\"" "$debug_file"; then
        echo "Found name match for goal: $goal_name" >&2
        
        # Extract the surrounding context to find the goal ID
        local section=$(grep -B 5 -A 20 "\"name\":\"$goal_name\"" "$debug_file")
        local goal_id=$(echo "$section" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
        
        if [ -n "$goal_id" ]; then
            echo "Found goal ID $goal_id with matching name $goal_name" >&2
            echo "$goal_id"
            return 0
        fi
    fi
    
    # No match found - send debug message to stderr
    echo "No matching goal found for $condition_url or $goal_name" >&2
    # Return nothing to stdout and non-zero exit code
    return 1
}

# Function to create a goal for a counter
create_goal() {
    local counter_id=$1
    local goal_name=$2
    local condition_type=$3
    local condition_url=$4
    local counter_goals_json=$5
    
    # Check if the goal already exists - capture both output and exit status
    local existing_goal_id=""
    local goal_exists_result=1
    
    existing_goal_id=$(goal_exists "$counter_id" "$goal_name" "$condition_url" "$counter_goals_json")
    goal_exists_result=$?
    
    # Only consider the goal as existing if goal_exists returned success (0)
    if [ $goal_exists_result -eq 0 ] && [ -n "$existing_goal_id" ]; then
        # Goal already exists, output link to the goal
        echo "🔄 Goal \"$goal_name\" already exists for counter $counter_id (ID: $existing_goal_id)"
        echo "   Link: https://metrika.yandex.ru/goals?id=$counter_id"
        
        # Save result to the results file
        echo "$counter_id|$goal_name|ALREADY_EXISTS|$existing_goal_id|$condition_url" >> "$RESULTS_FILE"
        return
    fi
    
    # Prepare JSON payload
    local json_data=$(cat <<EOF
{
  "goal": {
    "name": "$goal_name",
    "type": "action",
    "conditions": [
      {
        "type": "$condition_type",
        "url": "$condition_url"
      }
    ]
  }
}
EOF
    )
    
    # Make API request with curl
    echo "Creating goal \"$goal_name\" for counter $counter_id..."
    
    response=$(curl -s -X POST \
        -H "Authorization: OAuth $ACCESS_TOKEN" \
        -H "Content-Type: application/x-yametrika+json" \
        -d "$json_data" \
        "https://api-metrika.yandex.net/management/v1/counter/$counter_id/goals?pretty=1")
    
    # Check for errors in response
    if echo "$response" | grep -q "\"errors\""; then
        echo "❌ Failed to create goal for counter $counter_id"
        echo "Error details:"
        echo "-------------------------------------------------------------"
        echo "Full API Response:"
        echo "$response"
        echo "-------------------------------------------------------------"
        echo "HTTP Status: $(echo "$response" | grep -o '"code":[0-9]*' | cut -d':' -f2 || echo "Unknown")"
        echo "Error message: $(echo "$response" | grep -o '"message":"[^"]*"' | cut -d':' -f2- | tr -d '"' || echo "No detailed message")"
        
        # Show additional debug info if present
        if echo "$response" | grep -q '"errors"'; then
            echo "Additional error information:"
            echo "$response" | grep -o '"errors":\[[^]]*\]' | sed 's/"errors"://g' || echo "None"
        fi
        
        # Save result to the results file
        echo "$counter_id|$goal_name|ERROR||$condition_url" >> "$RESULTS_FILE"
    else
        # Extract the goal ID from the response
        local new_goal_id=""
        # Try to extract the goal ID using simple grep (more reliable than jq here)
        new_goal_id=$(echo "$response" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2 || echo "Unknown")
        
        echo "✅ Goal \"$goal_name\" successfully created for counter $counter_id (ID: $new_goal_id)"
        echo "   Link: https://metrika.yandex.ru/goals?id=$counter_id"
        
        # Save result to the results file
        echo "$counter_id|$goal_name|CREATED|$new_goal_id|$condition_url" >> "$RESULTS_FILE"
    fi
    
    # Add a small delay to avoid rate limiting
    sleep .5
}

# Function to print the summary report
print_summary_report() {
    # Initialize counters
    local total_goals=0
    local created_goals=0
    local existing_goals=0
    local error_goals=0
    
    # For each counter, print a separate section of the report
    for counter in "$@"; do
        # Initialize counter-specific counters
        local counter_total=0
        local counter_created=0
        local counter_existing=0
        local counter_error=0
        
        # Find all entries for this counter in the results file
        if [ -f "$RESULTS_FILE" ]; then
            echo ""
            echo "⚙️  Counter ID: $counter"
            echo "====================================================="
            echo "Goal key                     | Status          | Goal ID"
            echo "-----------------------------------------------------"
            
            # Process each line in the results file for this counter
            while IFS='|' read -r c_id goal_name status goal_id url; do
                if [ "$c_id" = "$counter" ]; then
                    # Update counters
                    counter_total=$((counter_total + 1))
                    total_goals=$((total_goals + 1))
                    
                    # Format status for display
                    local status_display=""
                    case "$status" in
                        "CREATED")
                            status_display="✅ Created       "
                            counter_created=$((counter_created + 1))
                            created_goals=$((created_goals + 1))
                            ;;
                        "ALREADY_EXISTS")
                            status_display="🔄 Already exists"
                            counter_existing=$((counter_existing + 1))
                            existing_goals=$((existing_goals + 1))
                            ;;
                        "ERROR")
                            status_display="❌ Error         "
                            counter_error=$((counter_error + 1))
                            error_goals=$((error_goals + 1))
                            ;;
                        *)
                            status_display="⚠️  Unknown       "
                            counter_error=$((counter_error + 1))
                            error_goals=$((error_goals + 1))
                            ;;
                    esac
                    
                    # Print entry - use condition URL from the 5th field in the results file
                    printf "%-28s | %-15s | %s\n" "$url" "$status_display" "$goal_id"
                fi
            done < "$RESULTS_FILE"
            
            # Print counter summary footer
            echo "-----------------------------------------------------"
            printf "Counter summary: %d goals total (%d created, %d existing, %d errors)\n" \
                   "$counter_total" "$counter_created" "$counter_existing" "$counter_error"
        else
            echo "No results found for counter $counter"
        fi
    done
    
    # Print overall summary
    echo ""
    echo "📊 Overall Summary"
    echo "====================================================="
    printf "Total goals processed: %d\n" "$total_goals"
    printf "  ✅ Created: %d\n" "$created_goals"
    printf "  🔄 Already exist: %d\n" "$existing_goals"
    printf "  ❌ Errors: %d\n" "$error_goals"
    echo "====================================================="
    echo "✅ Goal creation process completed!"
    echo ""
    echo "Visit https://metrika.yandex.ru/ to view your counters and goals"
}

# Main script execution

echo "📊 Starting goal creation process..."

# Parse counters JSON file (using grep for maximum reliability)
counters=()
# Extract numeric counter IDs
while read -r line; do
    if [[ $line =~ [0-9]+ ]]; then
        counters+=("${BASH_REMATCH[0]}")
    fi
done < "$COUNTERS_FILE"

# Check if we have counters
if [ ${#counters[@]} -eq 0 ]; then
    echo "Error: No counters found in $COUNTERS_FILE"
    exit 1
fi

echo "Found ${#counters[@]} counters to process"

# Parse goals JSON file (simple grep approach for reliability)
goal_names=()
condition_types=()
condition_urls=()

# For debugging, save goals.json to a temp file we can explore
cp "$GOALS_FILE" "${TEMP_DIR}/goals_debug.json"

# Default to 'exact' for all condition types since that's the type in goals.json
for i in {1..100}; do
    condition_types+=("exact")
done

# Extract goal names and condition URLs
while read -r line; do
    if [[ $line =~ \"name\"[[:space:]]*:[[:space:]]*\"([^\"]+)\" ]]; then
        goal_names+=("${BASH_REMATCH[1]}")
    elif [[ $line =~ \"url\"[[:space:]]*:[[:space:]]*\"([^\"]+)\" ]]; then
        condition_urls+=("${BASH_REMATCH[1]}")
    fi
done < "$GOALS_FILE"

# Make sure arrays are the same length
min_len=${#goal_names[@]}
[ ${#condition_urls[@]} -lt $min_len ] && min_len=${#condition_urls[@]}

# Trim arrays to match
goal_names=("${goal_names[@]:0:$min_len}")
condition_types=("${condition_types[@]:0:$min_len}")
condition_urls=("${condition_urls[@]:0:$min_len}")

# Debug output to console
echo "Extracted ${#goal_names[@]} goal names"
echo "Using ${#condition_types[@]} condition types (all set to 'exact')"
echo "Extracted ${#condition_urls[@]} condition URLs"

# Check if we parsed any goals
if [ ${#goal_names[@]} -eq 0 ]; then
    echo "Error: No goals found in $GOALS_FILE"
    exit 1
fi

echo "Found ${#goal_names[@]} goals to process"

# Reset results file
> "$RESULTS_FILE"

# Process each counter
for counter in "${counters[@]}"; do
    echo ""
    echo "🔄 Processing counter: $counter"
    
    # Fetch existing goals for this counter
    counter_goals_json=$(fetch_existing_goals "$counter")
    
    # Create each goal for this counter
    for (( i=0; i<${#goal_names[@]}; i++ )); do
        create_goal "$counter" "${goal_names[$i]}" "${condition_types[$i]}" "${condition_urls[$i]}" "$counter_goals_json"
    done
done

# Generate summary report
echo ""
echo "📋 Summary Report"
print_summary_report "${counters[@]}"
