// Scripted 6-turn conversation for the guitar-log chat (OldChat / ChatContext),
// driven by useGhostScript. Turn 1 is the original chat_stream.js response,
// recorded from a live agent run. Turns 2-6 are authored against the same
// real, exported 3-year listening data (frontend/src/demo/fixtures/analytics.json)
// and the real guitar log (songs.json) — every number below is pulled from
// those fixtures, not invented. Kept in the same {event, data, delayMs} SSE
// shape mockFetch.js already streams for /agent/chat.

import chat_stream from './chat_stream.js'

function messageEvents(chunks) {
  return chunks.map((chunk, i) => ({
    event: 'message',
    data: chunk,
    delayMs: i === 0 ? 300 : 55 + Math.floor(Math.random() * 30),
  }))
}

function toolEvents(count) {
  const events = []
  for (let i = 0; i < count; i++) {
    events.push({ event: 'tool_start', data: 'query_database', delayMs: i === 0 ? 500 : 200 })
    events.push({ event: 'tool_end', data: 'done', delayMs: 700 + Math.floor(Math.random() * 500) })
  }
  return events
}

function turn(toolCalls, chunks) {
  return [...toolEvents(toolCalls), ...messageEvents(chunks), { event: 'done', data: 'done', delayMs: 100 }]
}

const TURN_2 = [
  '## Learn "Soma" Next\n\n',
  'It’s sitting in your log as **want to learn** (tabs, difficulty 3) with your own note: *"My most played song ever. ',
  'Have to learn this one eventually."* In the last three years alone it’s racked up **420 plays** — and you already know ',
  '"Life Is Simple in the Moonlight" cold (chords, marked **learned**), so the Strokes rhythm-guitar muscle memory is already there. ',
  'This is the least risky "next" pick in your whole queue.\n\n---\n\n',
  '## The Bigger Gap: Arctic Monkeys\n\n',
  'Zero tabs logged for **Arctic Monkeys** — your **#4 artist over the last three years at 1,576 plays**. ',
  '"Secret Door" alone has **680 plays**, more than any other track in your library over that window, Soma included. ',
  'If the goal is "close the gap between what I play on guitar and what I actually listen to," this is the bigger miss, not Soma.',
]

const TURN_3 = [
  '## Elliott Smith Just Overtook The Strokes\n\n',
  'Over the **last year**, **Elliott Smith leads with 1,577 plays** — ahead of The Strokes at **955**, who have been your ',
  '#1 artist by total plays for as long as this data goes back. That’s a real handoff, not noise.\n\n---\n\n',
  '## 2023 Looked Very Different\n\n',
  'Back in 2023, the order was **The Strokes (1,079) → Lana Del Rey (984) → Baustelle (422) → Deftones (413)**. ',
  'Elliott Smith wasn’t even in the top 5 that year. Whatever happened, it happened recently — this looks like a 2025–2026 shift, not a slow drift.\n\n---\n\n',
  '## One More Data Point\n\n',
  'You have "Pictures of Me" (Elliott Smith) logged as **want to learn** on guitar, fingerpicking, with your own note calling out ',
  '"449 scrobbles." The guitar log already saw this coming before the yearly stats caught up to it.',
]

const TURN_4 = [
  '## Where Your Practice Queue Actually Stands\n\n',
  '**2 learned** — "Life Is Simple in the Moonlight" (The Strokes) and "Lovely Day" (Bill Withers). ',
  '**3 learning** — "Mala Gente" (Juanes, fighting the syncopation), "Eulogy For A Rock Band" (Weezer, power chords), ',
  'and "Gomma" (Baustelle — your note calls out the unusual chord shapes). ',
  '**5 want to learn**, unstarted.\n\n---\n\n',
  '## The Want-to-Learn Pile Isn’t Random\n\n',
  'Three of those five unstarted songs are by artists dominating your actual listening: "Soma" and "Meet Me in the Bathroom" ',
  '(both The Strokes, your all-time #1), and "Pictures of Me" (Elliott Smith, your #1 over the last year). ',
  'Your guitar backlog and your listening history are pointing at the same two artists — you just haven’t picked up the guitar for either yet.\n\n---\n\n',
  '## The Outlier\n\n',
  '"Gomma" by Baustelle is the one song in your log with no obvious listening-stats justification beyond raw play count — ',
  'it’s just a genuinely unusual song to be learning, which tracks, since Baustelle is the most unusual artist in your top 15 to begin with.',
]

const TURN_5 = [
  '## Thursday Is Your Peak Day\n\n',
  'Across the last three years: **Thu 8,057 plays**, Wed 7,831, Tue 7,472, Fri 7,422, Mon 7,301, Sat 6,899, and **Sun trails at 5,500** — ',
  'about 32% below your Thursday peak. Not a huge swing day-to-day, but it’s consistent: the back half of the workweek beats the weekend, every time.\n\n---\n\n',
  '## Reading Too Much Into It (On Purpose)\n\n',
  'If Sunday is your quietest listening day and also, presumably, closer to a "day off" — that argues *against* the idea that ',
  'more free time means more listening. This looks more like "music plays while I work" than "music is the leisure activity itself."',
]

const TURN_6 = [
  '## Your Top Track Isn’t From Your Top Artist\n\n',
  '"Secret Door" by **Arctic Monkeys** leads all tracks over the last three years at **680 plays** — but Arctic Monkeys is only ',
  'your #4 artist overall (1,576 plays across a much wider catalog). Meanwhile The Strokes, your #1 artist at 3,103 plays, ',
  'spread that total across way more songs — nothing of theirs cracks the track-level top 6.\n\n---\n\n',
  '## The Spanish-Language Thread\n\n',
  'You already know about the Italian side (Baustelle). Less obvious: **Andrés Calamaro** shows up *twice* in your top lists — ',
  '"Crimenes Perfectos" (624 plays, your #2 track) and the album *Alta Suciedad* (753 album plays, your #4 album). ',
  'Two separate non-English deep cuts holding down top-5 slots each is not a coincidence at this point — it’s a pattern.',
]

export default [
  { user: 'What does my listening history say about me?', stream: chat_stream },
  { user: 'What should I learn on guitar next?',                 stream: turn(2, TURN_2) },
  { user: 'What have I been listening to most this year vs 2023?', stream: turn(2, TURN_3) },
  { user: "How's my guitar practice going?",                     stream: turn(1, TURN_4) },
  { user: 'Which day of the week do I listen the most?',         stream: turn(1, TURN_5) },
  { user: 'Any surprises in my top albums or tracks?',           stream: turn(2, TURN_6) },
]
