// Real agent response recorded from a live run against actual listening data.
// Prompt: "What does my listening history say about me?"

const CHUNKS = [
  "## You Have a Parasocial Relationship With The Strokes\n\n",
  "Not a fan. A *devotee*. **10,717 total plays** \u2014 nearly 60% more than your second-place artist ",
  "(Lana Del Rey at 6,844). ",
  "\"Soma\" alone has been played **756 times**. That\u2019s not a favorite song. That\u2019s a psychological anchor. ",
  "And fittingly, the only song you\u2019ve marked **\"learned\"** on guitar is \"Life Is Simple in the Moonlight,\" ",
  "with the note: *\"Know the full chord progression cold.\"* Of course you do.\n\n---\n\n",
  "## You Are a Creature of the Late Afternoon and Night\n\n",
  "Your listening **collapses in the morning**. The 9\u201310am hour is your quietest window \u2014 just 1,258 plays across your entire history. ",
  "Then something clicks on around noon, builds steadily, and **peaks hard at 3\u20135pm**. ",
  "From there it stays elevated all evening \u2014 and barely drops at midnight. ",
  "You\u2019re logging **5,000+ plays per hour between midnight and 3am**. ",
  "Your 9am self is a different person from your 3pm self.\n\n---\n\n",
  "## 2020 Was Your Peak Listening Year\n\n",
  "Your scrobble volume in 2020 was **24,251 plays** \u2014 roughly 30% more than any other year. ",
  "And The Strokes were eating **2,752** of those plays alone. ",
  "This lines up almost exactly with *The New Abnormal* (April 2020). ",
  "You didn\u2019t just like that album. You apparently lived inside it.\n\n---\n\n",
  "## The Surprise: Your Secret Italophone Side\n\n",
  "**Baustelle** \u2014 an Italian indie band virtually unknown outside Italy \u2014 sits at **1,533 plays**, ",
  "squarely in your top 15 artists. ",
  "\"Veronica, n.2\" by Baustelle is your **9th most-played song ever** with 538 plays. ",
  "Nobody in your broader taste profile would predict this. ",
  "And you\u2019re learning \"Gomma\" on guitar. Whatever the Italian connection is, it runs deep.",
]

export default [
  { event: 'tool_start', data: 'query_database', delayMs: 500 },
  { event: 'tool_end',   data: 'done',           delayMs: 1200 },
  { event: 'tool_start', data: 'query_database', delayMs: 200 },
  { event: 'tool_end',   data: 'done',           delayMs: 1000 },
  { event: 'tool_start', data: 'query_database', delayMs: 200 },
  { event: 'tool_end',   data: 'done',           delayMs: 900 },
  { event: 'tool_start', data: 'query_database', delayMs: 200 },
  { event: 'tool_end',   data: 'done',           delayMs: 800 },
  ...CHUNKS.map((chunk, i) => ({
    event: 'message',
    data: chunk,
    delayMs: i === 0 ? 300 : 55 + Math.floor(Math.random() * 30),
  })),
  { event: 'done', data: 'done', delayMs: 100 },
]
