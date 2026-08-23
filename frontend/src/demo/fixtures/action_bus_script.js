// Scripted 7-turn conversation for the AI Action Bus (AnalyticsChat), driven
// by useGhostScript. Unlike CHAT_STUBS in mockFetch.js (an unordered bag of
// single-turn keyword replies), this is a deliberate, ordered walkthrough
// chaining multiple real ui_actions per turn — every number in `response`
// is pulled straight from the exported 3-year fixtures in analytics.json,
// not invented. mockFetch.js matches turns by exact `user` text; anything
// else still falls through to the CHAT_STUBS keyword table.

export default [
  {
    user: 'What are my top artists this year?',
    response:
      'Elliott Smith leads this year with 1,577 plays — ahead of The Strokes at 955, who have been your #1 artist by ' +
      'total plays for as long as this data goes back. Pulling up the Dashboard filtered to the last year.',
    ui_actions: [
      { type: 'navigate', payload: { path: '/dashboard' } },
      { type: 'set_time_range', payload: { period: '1y' } },
      { type: 'highlight_chart', payload: { chart_id: 'top_entities' } },
      { type: 'show_toast', payload: { message: 'Dashboard → top artists (1y)' } },
    ],
  },
  {
    user: 'How does that compare to 2023?',
    response:
      '2023 looked very different: The Strokes (1,079) → Lana Del Rey (984) → Baustelle (422) → Deftones (413). ' +
      'By 2024 it was The Strokes (1,207) → Arctic Monkeys (752) → The Voidz (680) → Lana Del Rey (640) — Arctic Monkeys ' +
      'jumping from outside the top 5 to #2. Opening Time Machine with both eras side by side.',
    ui_actions: [
      { type: 'navigate', payload: { path: '/timemachine' } },
      { type: 'set_era_preset', payload: { preset: '2024', from: '2024-01-01', to: '2025-01-01' } },
      { type: 'toggle_compare_mode', payload: { mode: 'vs_era' } },
      { type: 'set_compare_era', payload: { from: '2023-01-01', to: '2024-01-01' } },
      { type: 'highlight_chart', payload: { chart_id: 'timemachine_chart' } },
      { type: 'show_toast', payload: { message: 'Time Machine → 2024 vs 2023' } },
    ],
  },
  {
    user: 'Show me the genre breakdown',
    response:
      'Over the last year: indie (19.4%), indie rock (16.1%), alternative (12.7%), rock (10.9%), pop (6.6%), female ' +
      'vocalists (6.1%). Indie and its close relatives — indie rock, alternative — account for roughly half of everything ' +
      'you’ve played. Highlighting the genre chart on the Dashboard.',
    ui_actions: [
      { type: 'navigate', payload: { path: '/dashboard' } },
      { type: 'highlight_chart', payload: { chart_id: 'genre_mood' } },
      { type: 'show_toast', payload: { message: 'Dashboard → genre breakdown' } },
    ],
  },
  {
    user: 'Compare Lana Del Rey and Mitski',
    response:
      'Lana Del Rey: 6,946 all-time plays across 120 unique tracks. Mitski: 3,276 all-time plays across 37 unique tracks — ' +
      'less than a third of Lana’s catalog depth, but not far off in total plays per track. Opening Lana Del Rey’s ' +
      'deep dive and adding Mitski to compare.',
    ui_actions: [
      { type: 'navigate', payload: { path: '/explore/artist/Lana Del Rey' } },
      { type: 'set_time_range', payload: { period: 'all' } },
      { type: 'open_panel', payload: { panel: 'Compare' } },
      { type: 'add_compare_entity', payload: { type: 'artist', id: 'Mitski' } },
      { type: 'highlight_chart', payload: { chart_id: 'deepdive_chart' } },
      { type: 'show_toast', payload: { message: 'Compare: Lana Del Rey vs Mitski' } },
    ],
  },
  {
    user: 'Which artists have I been sleeping on?',
    response:
      'A few real ones: Diana Ross (75 plays, quiet since December 2023) and Die Antwoord (64 plays, nothing since late ' +
      '2024) — both cleared 50+ plays at some point, then went dormant. Filtering Discover to surface artists like these.',
    ui_actions: [
      { type: 'navigate', payload: { path: '/discover' } },
      { type: 'set_entity_type', payload: { entity_type: 'artist' } },
      { type: 'apply_filter', payload: { field: 'total_plays', operator: 'gte', value: 50 } },
      { type: 'set_sort', payload: { sort_by: 'days_since_last_heard', sort_dir: 'desc' } },
      { type: 'highlight_chart', payload: { chart_id: 'discover_table' } },
      { type: 'show_toast', payload: { message: 'Discover → dormant artists filter' } },
    ],
  },
  {
    user: 'Scatter plot of my top 50 artists',
    response:
      'The Strokes are the obvious outlier — 11,117 total plays and 0 days since last heard, meaning they’re still in ' +
      'daily rotation after years at #1. Most artists with that kind of career total have long since gone quiet; this one hasn’t. ' +
      'Building a scatter of total plays vs. days since last heard.',
    ui_actions: [
      { type: 'navigate', payload: { path: '/discover' } },
      { type: 'set_entity_type', payload: { entity_type: 'artist' } },
      { type: 'set_top_n', payload: { n: 50 } },
      { type: 'set_viz_type', payload: { viz_type: 'scatter' } },
      { type: 'set_viz_axes', payload: { x_metric: 'total_plays', y_metric: 'days_since_last_heard' } },
      { type: 'highlight_chart', payload: { chart_id: 'discover_viz' } },
      { type: 'show_toast', payload: { message: 'Discover → scatter: plays vs recency' } },
    ],
  },
  {
    user: 'Deep dive into The Strokes',
    response:
      '11,117 total plays across 80 unique tracks and 14 albums — the largest catalog spread of anyone in your history. ' +
      'Longest streak: 29 straight days. Peak week: February 17, 2020, at 173 plays — a couple months before The New ' +
      'Abnormal dropped, so this predates that album rather than being driven by it. Opening the full deep dive.',
    ui_actions: [
      { type: 'navigate', payload: { path: '/explore/artist/The Strokes' } },
      { type: 'set_time_range', payload: { period: 'all' } },
      { type: 'highlight_chart', payload: { chart_id: 'deepdive_chart' } },
      { type: 'show_toast', payload: { message: 'Deep Dive → The Strokes (all time)' } },
    ],
  },
]
