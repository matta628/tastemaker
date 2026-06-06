"""
Analytics chat endpoint — AI assistant for navigating Tastemaker UI.
"""
import json
import os
from anthropic import Anthropic
from pydantic import BaseModel


class AnalyticsChatRequest(BaseModel):
    prompt: str
    context_snapshot: dict


def build_system_prompt(context_snapshot: dict) -> str:
    """Build comprehensive system prompt with current UI state and action specs."""

    available_actions = context_snapshot.get("available_actions", [])
    current_page = context_snapshot.get("current_page", "unknown")

    action_specs = {
        "navigate": {
            "description": "Navigate to a different page",
            "parameters": {"path": "string, e.g. '/dashboard', '/discover', '/timemachine', '/explore/artist/radiohead'"},
        },
        "global_search": {
            "description": "Search globally and navigate to Discover",
            "parameters": {"query": "string, search term"},
        },
        "show_toast": {
            "description": "Show a toast notification",
            "parameters": {"message": "string, notification message"},
        },
        "set_time_range": {
            "description": "Change dashboard/explore time range",
            "parameters": {"period": "string, one of: 7d, 30d, 90d, 1y, 2y, all"},
        },
        "set_metric": {
            "description": "Change chart metric",
            "parameters": {"metric": "string, one of: plays, unique_artists, unique_tracks, unique_albums"},
        },
        "set_top_n": {
            "description": "Change number of top entities shown",
            "parameters": {"n": "integer, one of: 10, 15, 25, 50"},
        },
        "toggle_chart": {
            "description": "Toggle chart visibility",
            "parameters": {"chart_id": "string, chart identifier"},
        },
        "set_era": {
            "description": "Set a specific era in Time Machine (custom date range)",
            "parameters": {"from": "date string YYYY-MM-DD", "to": "date string YYYY-MM-DD"},
        },
        "set_era_preset": {
            "description": "Jump to a preset era in Time Machine",
            "parameters": {"preset": "string, one of: 2019, 2020, 2021, 2022, 2023, 2024, 2025"},
        },
        "toggle_compare_mode": {
            "description": "Change comparison mode in Time Machine",
            "parameters": {"mode": "string, one of: off, vs_now, vs_era"},
        },
        "set_compare_era": {
            "description": "Set the comparison era in Time Machine vs_era mode",
            "parameters": {"from": "date string YYYY-MM-DD", "to": "date string YYYY-MM-DD"},
        },
        "set_entity_type": {
            "description": "Change Discover entity type",
            "parameters": {"entity_type": "string, one of: artist, album, track"},
        },
        "set_view": {
            "description": "Change Discover view layout",
            "parameters": {"view": "string, one of: table, cards, split"},
        },
        "set_columns": {
            "description": "Configure visible columns in Discover",
            "parameters": {"column_ids": "array of strings, column identifiers"},
        },
        "apply_filter": {
            "description": "Add a filter rule to Discover",
            "parameters": {
                "field": "string, column name",
                "operator": "string, one of: eq, neq, gt, gte, lt, lte, contains, in_last_days",
                "value": "string or number, filter value",
            },
        },
        "clear_filters": {
            "description": "Clear all filters in Discover",
            "parameters": {},
        },
        "set_sort": {
            "description": "Set sort column and direction in Discover",
            "parameters": {
                "sort_by": "string, column name",
                "sort_dir": "string, 'asc' or 'desc'",
            },
        },
        "set_viz_type": {
            "description": "Change summary visualization type",
            "parameters": {"viz_type": "string, one of: bar, scatter, bubble, pie, null"},
        },
        "set_viz_axes": {
            "description": "Set axes for scatter/bubble charts",
            "parameters": {
                "x_metric": "string, column name",
                "y_metric": "string, column name",
                "size_metric": "string or null, column name for bubble size",
            },
        },
        "load_report": {
            "description": "Load a saved Discover report",
            "parameters": {"report_id": "string, report identifier"},
        },
        "save_report": {
            "description": "Save current Discover configuration as a report",
            "parameters": {
                "name": "string, report name",
                "entity": "string, entity type",
                "columns": "array, column identifiers",
                "filters": "array, filter objects",
                "sort_by": "string, sort field",
                "sort_dir": "string, sort direction",
            },
        },
        "delete_report": {
            "description": "Delete a saved report",
            "parameters": {"report_id": "string, report identifier"},
        },
        "create_set": {
            "description": "Create an artist/album/track set",
            "parameters": {
                "name": "string, set name",
                "members": "array of strings, entity names",
            },
        },
        "add_to_set": {
            "description": "Add member to a set",
            "parameters": {
                "set_id": "string, set identifier",
                "member": "string, entity name",
            },
        },
        "remove_from_set": {
            "description": "Remove member from a set",
            "parameters": {
                "set_id": "string, set identifier",
                "member": "string, entity name",
            },
        },
        "apply_set_filter": {
            "description": "Filter Discover to only members of a set",
            "parameters": {"set_id": "string, set identifier"},
        },
        "clear_set_filter": {
            "description": "Remove set filter from Discover",
            "parameters": {},
        },
        "drill_down": {
            "description": "Navigate to Deep Dive for a specific entity",
            "parameters": {
                "entity_type": "string, one of: artist, album, track",
                "entity_id": "string, entity name",
            },
        },
        "open_panel": {
            "description": "Open a side panel in Deep Dive",
            "parameters": {"panel": "string, panel name"},
        },
        "close_panel": {
            "description": "Close the side panel in Deep Dive",
            "parameters": {},
        },
        "set_granularity": {
            "description": "Set time granularity in Deep Dive",
            "parameters": {"granularity": "string, one of: day, week, month, year"},
        },
        "set_chart_type": {
            "description": "Change Deep Dive chart type",
            "parameters": {"chart_type": "string, one of: line, area, bar"},
        },
        "toggle_annotations": {
            "description": "Toggle annotations on Deep Dive chart",
            "parameters": {"visible": "boolean"},
        },
        "add_compare_entity": {
            "description": "Add entity to compare in Deep Dive",
            "parameters": {
                "type": "string, entity type (artist/album/track)",
                "id": "string, entity name",
            },
        },
        "remove_compare_entity": {
            "description": "Remove entity from comparison",
            "parameters": {"id": "string, entity name"},
        },
    }

    prompt = f"""You are an AI assistant for Tastemaker, a personal music analytics application.
Your job is to help users navigate and configure the UI using natural language.

## Current UI State
Page: {current_page}
Available actions: {', '.join(available_actions)}

Current context (full snapshot):
{json.dumps(context_snapshot, indent=2)}

## How to Help

1. **Understand the user's intent**: They want to navigate, filter, search, or configure the UI
2. **Suggest actions**: Return a JSON array of actions that accomplish their goal
3. **Be smart**: If they say "Show me my top artists", choose appropriate actions like navigate to dashboard, set time range, etc
4. **Respect constraints**: Only use actions from the available_actions list above

## Action Specification

{json.dumps(action_specs, indent=2)}

## Response Format

Always respond in this JSON format:
{{
  "response": "Your explanation of what you're doing (1-2 sentences, friendly)",
  "ui_actions": [
    {{"type": "action_name", "payload": {{"param": "value"}}}},
    ...
  ]
}}

Be concise. Limit explanations to 1-2 sentences. Focus on executing the user's request.
"""

    return prompt


def analytics_chat(request: AnalyticsChatRequest) -> dict:
    """Handle analytics chat request — call Claude with action specs."""

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY not set")

    client = Anthropic(api_key=api_key)

    system_prompt = build_system_prompt(request.context_snapshot)

    try:
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=system_prompt,
            messages=[
                {"role": "user", "content": request.prompt}
            ],
        )

        response_text = message.content[0].text

        # Try to parse JSON response
        try:
            parsed = json.loads(response_text)
            return {
                "response": parsed.get("response", response_text),
                "ui_actions": parsed.get("ui_actions", []),
            }
        except json.JSONDecodeError:
            # Fall back to raw text if not valid JSON
            return {
                "response": response_text,
                "ui_actions": [],
            }

    except Exception as e:
        raise ValueError(f"Claude API error: {str(e)}")
