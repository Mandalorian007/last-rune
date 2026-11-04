# The Last Rune: script

The whole game's words, in play order. Source of truth is the data in
`games/last-rune/content/lines.ts`, `journal.ts` and `ending.ts`. A test
(`content/content.test.ts`) fails if any line, page or plate there is missing from this file.

- Lines without a marker are verbatim from `pitch-v0.3.md` (also tested).
- **[NEW]** marks lines written for the game. Every FUSE plate under a journal page is new.
- `id · Nw` under each line is the data id and word count. A card holds at most 20 words.
  The 13 pitch lines that run longer (21 to 26 words; the final report is 36) are kept verbatim and shown as two or three cards, split at
  a sentence by `cardsOf()`. Every new line fits one card.
- Machine order inside a tier is one valid route. The real order is the player's
  (see `progression.md`). Pages are numbered by the Builder's chronology, not by when they
  are found.

## How the lines carry the story

**Tiers.** Tier 1 is pure comedy and FUSE never says "I". In Tier 2 the jokes get specific
in ways a robot shouldn't manage. The "I" comes from the pitch lines only; new Tier 2 lines
add none. In Tier 3 he gets quiet and fast, and the "I" breaks through mid-sentence. At the
Last Rune he says nothing until the final gem. Tested "I" counts: Tier 1 = 0 < Tier 2 < Tier 3.

**The clue ladder** (pitch §4), in the order the player meets it:

| Rung | Clue | Where it is laid |
|---|---|---|
| 1 | He knows every solution but can't place gems | Tier 1: conveyor arrive, page 5 ("Knew where each one went. Hands didn't."). Tier 2: press arrive ("Amplify before Split"), crane arrive ("Clamps can't hold a gem"), page 9 |
| 2 | Journal handwriting matches his report font | Page 1 is drawn in his report face. Page 4's plate: "Similar handwriting. Common handwriting." Page 9 is written *as* an incident report, and its plate notices. Page 16's signature runs on into his sign-off, "Monitoring.", and the booth solve says "My handwriting." |
| 3 | He quotes a page he says he never read | Page 4 (relay, Tier 1) holds "They say nothing on this floor runs hot enough." The archive solve (Tier 2) quotes it. The relay is a prerequisite of the archive, so page 4 is always found first (tested). Page 6's plate: "This unit has not read that page." |
| 4 | The Builder's last entry is dated the day his count started | Page 16 is dated **Day 1**. FUSE's count is on screen from the intake desk ("Day 14,610"). The other pages count up from Day 9,131, so Day 1 jumps out |
| 5 | He says "I" instead of "the Builder" and stops mid-sentence | Tier 2: foundry solve, and boiler solve ("My… the Builder's idea"). Tier 3 says the swap out loud: capacitor solve ("I… the Builder cut it last"), lift solve ("I… the Builder wrote that"), the Tier 3 hall echo, the Tier 3 reactions, and the plates on pages 13 to 15 |
| **Said** | FUSE works it out | Control booth solve, after page 16: "Oh. I'm the Builder." Once, plainly. The Last Rune's silence and "it was mine" follow from it |

**Rhymes** (each page answers something FUSE says in the same tier):

| Page | Rhymes with |
|---|---|
| 1 forms | intake arrive: "There's a form for that." |
| 2 furnace not hot enough | furnace arrive: "Went cold the week Management left." |
| 3 split the team | splitter arrive: "Management loved committees." |
| 4 Regulation 9 | relay arrive: "Two signatures. Regulation 9. Nobody remembers who signed." |
| 5 carried the parts | conveyor arrive: "Carried parts to the big one. Then carried them back." |
| 6 Amplify before Split | press arrive and solve |
| 7 six hundred and twelve | foundry solve |
| 8 shutdown order | storm cell arrive: "The committee said it couldn't be built." |
| 9 incident report: dropped a Bend | crane arrive: "Clamps can't hold a gem. Noted. Resented." |
| 10 Regulation 14 | archive arrive: "Regulation 14: drawers open only for their owner." |
| 11 memory going | archive solve: "You've read the pages. This unit hasn't." |
| 12 the cot | boiler arrive and solve (the solve says the page: "In case it wakes up at night.") |
| 13 ice cut last | capacitor bay solve: "I… the Builder cut it last. Ran the sums on later." |
| 14 hates heights | lift solve: "Hate heights. Went anyway. I… the Builder wrote that." (before the page is found) |
| 15 Management's last memo | roof solve: "keep the lights on until someone comes back." |
| 16 the drawers were mine | booth solve: "My drawers. My chair. Oh. I'm the Builder." |

**Regulations** (FUSE's running gag. Each one is also a fact):

| # | Says | Where |
|---|---|---|
| 1 | The hallway rune | intake solve |
| 2 | This unit does not do a victory noise | intake solve |
| 3 | Nobody sits in the booth | booth locked, 10×8 socket (and the chair is adjusted for him) |
| 4 | Nowhere is not a destination | Tier 1 dead-bolt reaction |
| 5 | Greed trips breakers | amplify codex |
| 6 | Candles are lighting, not decoration | title chatter (the title has no lamps, only candles) |
| 7 | Floors are not filing | page 1 plate |
| 8 | Don't ask where Management went | relay solve, crane solve, archive solve, booth arrive ("covers coincidences"), booth solve ("does not cover this"), page 8 plate |
| 9 | Two signatures | relay arrive, gate codex, page 4 (the Builder wrote it) |
| 12 | Press Unit 4: a Split and an Amplify | press locked, Tier 3 hall echo ("I wrote Regulation 12") |
| 14 | Drawers open only for their owner | archive arrive, page 10 (the Builder wrote it). Pays off in "Turns out I had a key the whole time." |

Visitor #4,211 is the player's running incident file. The safety record on the ending
screen (`safetyRecordLine`) closes it.

## Tier 1

### Hall

*Title screen, a knock.*

> Oh. Someone's at the door. Nobody's at the door. Nobody's been at the door for forty years.  
> <sub>`beat.title-knock` · 17w</sub>

*Title screen, idle chatter.* While nobody presses anything, FUSE potters about and says one of
these every 12 to 20 seconds, shuffled, no repeats until all have been said (`titleLines`,
`scenes/title/chatter.ts`). Tier 1 rules: no "I". Nothing about the Builder, the door or the
ending. They stop the moment the player starts.

> Day 14,610. Candles: lit. Storm: present. Visitors: possibly one. Logging it as one. **[NEW]**  
> <sub>`title.1` · 13w</sub>

> Shift report: nothing happened. Nothing happened very thoroughly. Filed in triplicate. **[NEW]**  
> <sub>`title.2` · 11w</sub>

> The storm checks in every night. Punctual. More than can be said for Management. **[NEW]**  
> <sub>`title.3` · 14w</sub>

> Storm cell. Don't tap the glass. It taps back. **[NEW]**  
> <sub>`title.4` · 9w</sub>

> This unit is not pacing. This unit is patrolling. There's a form that says so. **[NEW]**  
> <sub>`title.5` · 15w</sub>

> Safety record: 14,610 days without incident. Also without anything else. Spotless. **[NEW]**  
> <sub>`title.6` · 11w</sub>

> Hard hats are mandatory. This unit is a hard hat. Compliance achieved. **[NEW]**  
> <sub>`title.7` · 12w</sub>

> Visitor log, page one. Still page one. Page one is getting nervous. **[NEW]**  
> <sub>`title.8` · 12w</sub>

> Thunder. Count the seconds. Fourteen. This unit counts days too. Busy unit. **[NEW]**  
> <sub>`title.9` · 12w</sub>

> Rain is just a storm that gave up. Don't tell the rain. **[NEW]**  
> <sub>`title.10` · 12w</sub>

> Management stepped out. Forty years ago. Their coffee is still on the desk. It's geology now. **[NEW]**  
> <sub>`title.11` · 16w</sub>

> Eyes: one of two operational. Fifty percent. That's a passing grade here. **[NEW]**  
> <sub>`title.12` · 12w</sub>

> No rush. Forty years of waiting. Another minute is a rounding error. **[NEW]**  
> <sub>`title.13` · 12w</sub>

> Incident report: visitor is standing very still. Outcome: so is this unit. Stalemate. **[NEW]**  
> <sub>`title.14` · 13w</sub>

> Wet floor sign is out. Floor isn't wet. Sign has nowhere else to be. **[NEW]**  
> <sub>`title.15` · 14w</sub>

> The candles get a performance review every Friday. They always pass. Warm personalities. **[NEW]**  
> <sub>`title.16` · 13w</sub>

> Echo test. Hello. Hello. Still just the echo. Good acoustics, though. **[NEW]**  
> <sub>`title.17` · 11w</sub>

> Quiet tonight. Just the storm, the candles and this unit. And you. Big crowd. **[NEW]**  
> <sub>`title.18` · 14w</sub>

> Fire exits are clearly marked. Lightning exits are a work in progress. **[NEW]**  
> <sub>`title.19` · 12w</sub>

> Lost property: one umbrella. Unclaimed. Optimistic purchase, for a lightning factory. **[NEW]**  
> <sub>`title.20` · 11w</sub>

> Regulation 6: candles are lighting, not decoration. Regulation 6 was a long night. **[NEW]**  
> <sub>`title.21` · 13w</sub>

> Somewhere upstairs a drawer is stuck shut. Has been for forty years. Out of spite. **[NEW]**  
> <sub>`title.22` · 15w</sub>

*first-entry*

> Welcome to the facility. Start with the intake desk: the gold doorway. Mistakes cost nothing here. Management made sure. Management made a lot of them.  
> <sub>`hall.first-entry.t1.1` · 14w</sub>

*ambient*

> Storm's coming. Good. We're a lightning factory. Rain would be awkward.  
> <sub>`hall.ambient.t1.1` · 11w</sub>

### Locked doors heard in Tier 1

**Press Unit 4** (until `gem:split`)

> Needs a Split. Regulation 12. Someone wrote Regulation 12 while having a day.  
> <sub>`press-unit-4.locked` · 13w</sub>

**Boiler Room** (until `storm:2`)

> Needs a double bolt. Storm Cell II. It's upstairs. Everything important is upstairs.  
> <sub>`boiler-room.locked` · 13w</sub>

**Archive** (until `altar:8x6`)

> Needs the crane. The crane needs the relay. The relay needs patience. Everything here needs something.  
> <sub>`archive.locked` · 16w</sub>

**Foundry** (until `gem:gate`)

> Foundry. Wants an Amplify and a Gate. It cut them both, once. Now it wants them back. Typical foundry. **[NEW]**  
> <sub>`foundry.locked` · 17w</sub>

**The Last Rune** (until `altar:10x8`)

> The big one. Everything goes in. Nothing's ever come out. Management called it a door. Management called everything something. **[NEW]**  
> <sub>`the-last-rune.locked` · 19w</sub>

### Intake Desk `intake-desk`

*Hall, hovering the open door* (its arrive line is an altar instruction, so the hall gets its own)

> The intake desk. All visitors start here. The form is inside. It has been waiting a while. **[NEW]**  
> <sub>`intake-desk.door` · 16w</sub>

*Arrive*

> Day 14,610. A visitor. There's a form for that. Step one: gem from the tray, onto a lit socket. **[NEW]**  
> <sub>`intake-desk.arrive` · 19w</sub>

*Solve*

> Regulation 1: the hallway rune. Regulation 2: this unit does not do a victory noise. Bzzt. That wasn't one.  
> <sub>`intake-desk.solve` · 19w</sub>

**Journal page 1** · Day 9,131

> *Intake desk reopened. First visitor in a month. Committee again. They brought forms.*

FUSE's plate **[NEW]**:

> Unfiled paperwork. Found on a floor. Floors are not filing. Regulation 7.

### Furnace `furnace`

*Arrive*

> The furnace. Went cold the week Management left. Everything did. Unrelated.  
> <sub>`furnace.arrive` · 11w</sub>

*Solve*

> An Amplify doubles the charge. Stack two and the second one just feels important. Like a deputy foreman.  
> <sub>`furnace.solve` · 18w</sub>

**Journal page 2** · Day 9,402

> *Furnace runs hot enough for everything except the one thing I built it for.*

FUSE's plate **[NEW]**:

> The furnace runs hot enough. For most things. This unit will not be taking questions.

### Splitter Mill `splitter-mill`

*Arrive*

> Splitter Mill. Takes one thing and makes it two smaller things. Management loved it. Management loved committees.  
> <sub>`splitter-mill.arrive` · 17w</sub>

*Solve*

> Half and half. Like this unit's optimism. Incident report #4,211: visitor appears competent. Monitoring.  
> <sub>`splitter-mill.solve` · 14w</sub>

**Journal page 3** · Day 10,005

> *Split the team in two. Half stayed. Half were right.*

FUSE's plate **[NEW]**:

> Half stayed. This unit counts as staying. Technically. Staying is most of the job.

### Relay Tower `relay-tower`

*Arrive*

> The relay. Needs two signals at once to pass one. Two signatures. Regulation 9. Nobody remembers who signed.  
> <sub>`relay-tower.arrive` · 18w</sub>

*Solve*

> A Gate. Good. Regulation 8: don't ask where Management went. Regulation 8 is new. Regulation 8 is for you.  
> <sub>`relay-tower.solve` · 18w</sub>

**Journal page 4** · Day 10,366 **[NEW]**

> *They say nothing on this floor runs hot enough. Two signatures on it. Regulation 9. I wrote Regulation 9, so that's on me.*

FUSE's plate **[NEW]**:

> Regulation 9 is a good regulation. Whoever wrote it had excellent handwriting. Similar handwriting. Common handwriting.

### Conveyor A `conveyor-a`

*Arrive*

> Conveyor A. Carried parts to the big one. Then carried them back. Then stopped. Very relatable machine.  
> <sub>`conveyor-a.arrive` · 17w</sub>

*Solve*

> Moving again. The sound it makes. That's… a sound. Carry on.  
> <sub>`conveyor-a.solve` · 11w</sub>

**Journal page 5** · Day 10,950 **[NEW]**

> *Conveyor's down again. Carried the parts to the big one myself. Then carried them back. Knew where each one went. Hands didn't.*

FUSE's plate **[NEW]**:

> Knowing where things go is the easy part. This unit would know.

## Tier 2

### Hall

*ambient*

> Day 14,610. Still. Long day. Good long day. Don't put that in a report. **[NEW]**  
> <sub>`hall.ambient.t2.1` · 14w</sub>

### Locked doors heard in Tier 2

**Capacitor Bay** (until `altar:8x6`)

> Capacitor bay. Double charge, bigger altar. Saving for later. Later is the one thing this facility has in stock. **[NEW]**  
> <sub>`capacitor-bay.locked` · 19w</sub>

**Roof Array** (until `gem:capacitor`)

> The roof. Wants the ice gem first. Also the lift. Or the ladder. This unit does not do ladders. **[NEW]**  
> <sub>`roof-array.locked` · 19w</sub>

**Control Booth** (until `machines`)

> The booth. Wants every machine awake first. Regulation 3: nobody sits in the booth. Regulation 3 is firm. **[NEW]**  
> <sub>`control-booth.locked` · 18w</sub>

### Press Unit 4 `press-unit-4`

*Arrive*

> Press Unit 4. Sulking since the committee. The trick is Amplify before Split, never after. Not that anyone asked. Nobody asks.  
> <sub>`press-unit-4.arrive` · 21w</sub>

*Solve*

> Amplify before Split. Told you. Didn't tell you. Thought it loudly. Incident report: visitor hears thoughts. Monitoring harder.  
> <sub>`press-unit-4.solve` · 18w</sub>

**Journal page 6** · Day 11,288

> *Amplify before Split. Wrote it on the wall so I'd stop forgetting.*

FUSE's plate **[NEW]**:

> This unit has not read that page. Correct, though. Amplify before Split.

### Storm Cell II `storm-cell-2`

*Arrive*

> Second storm cell. Double the bolt. The committee said it couldn't be built. The committee also said that about the first one.  
> <sub>`storm-cell-2.arrive` · 22w</sub>

*The tarp comes off. The Builder's sketch of the Last Rune.*

> That's not on the floor plan. It's checked daily. It's a lot of checking. Someone drew that from memory.  
> <sub>`beat.tarp` · 19w</sub>

*Solve*

> Two bolts. Both my eyes are on. That hasn't happened since… it's dust. There's dust. Forty years of it.  
> <sub>`storm-cell-2.solve` · 19w</sub>

**Journal page 8** · Day 12,001

> *The committee came with a shutdown order. I signed it. I didn't say when.*

FUSE's plate **[NEW]**:

> Signed it and didn't say when. Bold. Regulation 8 now applies retroactively.

### Crane `crane`

*Arrive*

> The crane. Lifts the big stones. Hands are overrated. This unit has clamps. Clamps can't hold a gem. Noted. Resented.  
> <sub>`crane.arrive` · 20w</sub>

*Solve*

> Bigger altar. More sockets. More ways to be wrong. Ask me how I know. Don't. Regulation 8.  
> <sub>`crane.solve` · 17w</sub>

**Journal page 9** · Day 12,410 **[NEW]**

> *Incident report: Builder dropped a Bend. Twice. Outcome: knows exactly where it goes. Hands decline to comment. Monitoring.*

FUSE's plate **[NEW]**:

> That's the incident report format. That's this unit's format. Who taught the Builder the format.

### Boiler Room `boiler-room`

*Arrive*

> Boiler room. The Builder slept here, toward the end. There's a cot. It's a very specific cot. Nobody told this unit that.  
> <sub>`boiler-room.arrive` · 22w</sub>

*Solve*

> Warm again. The cot faces the big one. My… the Builder's idea. In case it wakes up at night. **[NEW]**  
> <sub>`boiler-room.solve` · 19w</sub>

**Journal page 12** · Day 13,190

> *Moved the cot to face the big one. If it wakes up at night I want to see it.*

FUSE's plate **[NEW]**:

> Facing the big one. Yes. Better view. Not that this unit has slept there.

### Archive `archive`

*Arrive*

> The archive. Drawers. Can't open one. Regulation 14: drawers open only for their owner. So, not this unit. Presumably. **[NEW]**  
> <sub>`archive.arrive` · 19w</sub>

*Solve*

> You've read the pages. This unit hasn't. 'They say nothing on this floor runs hot enough.' That's page four. How is that… Regulation 8. Regulation 8.  
> <sub>`archive.solve` · 26w</sub>

**Journal page 10** · Day 12,733 **[NEW]**

> *Regulation 14: no drawer opens for anyone but its owner. Wrote that for the committee. Kept the key somewhere obvious. On me.*

FUSE's plate **[NEW]**:

> Regulation 14. Of course it was the Builder. Of course it was. Drawers.

**Journal page 11** · Day 12,734 **[NEW]**

> *Writing it all down now. Memory's going the way of the hands. In case someone has to read this. In case it's me.*

FUSE's plate **[NEW]**:

> In case it is who. Nobody here forgets things. This unit has never once… Monitoring.

### Foundry `foundry`

*Arrive*

> Foundry. Where the gems were cut. The Splits never came out right. Too proud. Cut them anyway.  
> <sub>`foundry.arrive` · 18w</sub>

*Solve*

> I cut… the foundry cut six hundred gems. Six hundred and twelve. Why is that a number this unit has.  
> <sub>`foundry.solve` · 20w</sub>

**Journal page 7** · Day 11,604

> *Six hundred and twelve gems. The Splits are too proud. Keeping them anyway.*

FUSE's plate **[NEW]**:

> Six hundred and twelve. Somebody counted them. Somebody here counts everything.

## Tier 3

### Hall

*echo*

> Press Unit 4 wants a Split and an Amplify. Regulation 12. I wrote Regulation 12. I was having a day.  
> <sub>`hall.echo.t3.1` · 20w</sub>

*echo*

> The furnace went cold the week I… the week Management left. Related. Probably related. **[NEW]**  
> <sub>`hall.echo.t3.2` · 14w</sub>

### Locked doors heard in Tier 3

### Capacitor Bay `capacitor-bay`

*Arrive*

> Capacitor bay. Stores a bolt for later. The committee said that was cheating. It is. Do it anyway.  
> <sub>`capacitor-bay.arrive` · 18w</sub>

*Solve*

> Ice gem. Cut it last. I… the Builder cut it last. Ran the sums on later. Later was short. **[NEW]**  
> <sub>`capacitor-bay.solve` · 19w</sub>

**Journal page 13** · Day 13,512 **[NEW]**

> *Cut the ice one last. It holds a charge for later. Ran the sums on later. Later is short.*

FUSE's plate **[NEW]**:

> Later was short. I know. This unit knows. Somebody knows.

### Lift Shaft `lift-shaft`

*Arrive*

> Lift to the roof. Hasn't run since the day the counting started. Day one. The count started for a reason. Can't find the form.  
> <sub>`lift-shaft.arrive` · 24w</sub>

*Solve*

> Going up. Hate heights. Went anyway. I… the Builder wrote that. This unit has no setting for heights. **[NEW]**  
> <sub>`lift-shaft.solve` · 18w</sub>

**Journal page 14** · Day 13,877 **[NEW]**

> *Took the lift up to watch the storm. Hate heights. Went anyway. Up there, the whole thing finally makes sense.*

FUSE's plate **[NEW]**:

> Said it before reading it. Hates heights. Went anyway. I would have… the Builder did.

### Roof Array `roof-array`

*Arrive*

> The roof. The storm's right there. Forty years it's come every night and found nobody home. Tonight it's looking at you.  
> <sub>`roof-array.arrive` · 21w</sub>

*Solve*

> Array's live. The whole sky's wired to the floor now. Management said keep the lights on until someone comes back. I assumed they meant them.  
> <sub>`roof-array.solve` · 25w</sub>

**Journal page 15** · Day 14,240 **[NEW]**

> *Management's last memo: keep the lights on until someone comes back. Nobody's coming back. Someone will have to keep them on.*

FUSE's plate **[NEW]**:

> Until someone comes back. I thought… this unit assumed. Assumed wrong.

### Control Booth `control-booth`

*Arrive*

> The booth. The Builder's chair. Nobody sits in it. It's… it's adjusted. For a unit this height. That's a coincidence. Regulation 8 covers coincidences.  
> <sub>`control-booth.arrive` · 24w</sub>

*Solve. The reveal: said plainly, once, on one card, so it is read before Continue appears.*

> Page sixteen. Day 1. My handwriting. My drawers. My chair. Oh. I'm the Builder. Regulation 8 does not cover this. **[NEW]**  
> <sub>`control-booth.solve` · 19w</sub>

**Journal page 16** · Day 1

> *It can't be finished in a lifetime. Fine. I'll stop having one. The foreman unit has room. If this works, it'll keep the lights on and it won't remember why, which is a mercy. If someone comes: tell it the drawers were mine. Tell it the count can stop.*

*— signed, and then the signature trails into the same hand as every incident report.* The loops
tighten, flatten and run on into legible words in the page's hand: **Monitoring.** (FUSE's sign-off;
`signOff` in `journal.ts`).

FUSE's plate: *(blank)*. He has already said it at the booth; the page ends in his own word.

## The Last Rune

*No line on arrival. No line while you work. The corner card is empty for the first time in the game.*

*Only when the final gem is set:*

> Incident report, final. Visitor completed the facility. Foreman unit is going to need a new hobby. Foreman unit has had one hobby for forty years and it was this, and it was mine, and it's done.  
> <sub>`beat.rune-final-report` · 36w</sub>

> Go on. I'll get the lights.  
> <sub>`beat.rune-lights` · 6w</sub>

*The rune catches the storm. It was always a door. The player walks toward it. FUSE doesn't move.*

> Oh. It's not for you. Is it.  
> <sub>`beat.rune-not-for-you` · 7w</sub>

*FUSE rolls to the edge of the gold light. Stops. Clipboard still in his clamp.*

> Forty years keeping a door lit for someone to come home through. Should've checked who was on the list.  
> <sub>`beat.door-list` · 19w</sub>

> You'll want the forms. They're in the drawers. Turns out I had a key the whole time.  
> <sub>`beat.door-key` · 17w</sub>

*He drops the clipboard. It lands on the floor. He goes through. The screen goes white.*

*The white warms to gold. In the light, a window opens on a community hangout in full swing: ThunderClap Gaming. FUSE rolls in and wanders the channels:* (D-038)

The window is a chat drawn in the game's own style. Its sidebar is the server's real channel
list, in order: 👋 welcome, 🧑 introductions, 💬 the-hangout, 👀 supporter-sneak-peeks,
💬 supporter-chat, 🏆 events-and-contests, 🐈 furry-friends, 🍔 omg-food, 🎶 jammin-out,
🍜 otaku-oasis, 📚 book-worms, 🌱 watch-me-grow, ⚽ sports-ball, 🚗 gearhead. Unread pips light
up as the server notices him; his face sits beside the channel he is in. FUSE types his posts
into the message bar, then sends them. Reactions are real emoji with counts ticking up. Every
member but ThunderSoap is invented. **[NEW]** throughout, except FUSE's three closing lines.

**Already in the channels.**

- #welcome. ThunderSoap: Welcome in! Grab a seat and say hi in 🧑 introductions 💜
- #introductions. kettle.knight: hi all! I'm Kettle. I like tea and losing at chess ☕
- #the-hangout. grumbleberry: the water level is the best level and I will die on this hill /
  pixel_pudding: you WILL die on that hill. you'll drown on it / grumbleberry: TAKE THAT BACK
- #jammin-out. ohm_sweet_ohm: 🔊🔊🔊 TURN IT UP 🔊🔊🔊
- #gearhead. torque.taco: rewired my own headlights last night 🔧 only one small fire
- #watch-me-grow. mossy.lamp: Day 212 of my sourdough starter. His name is Kevin 🌱

**#welcome.** A join notice: FUSE came through the door. Say hi! (👋 9)

**#introductions.** FUSE posts, with a paper form clipped on (*New arrival.* Name: FUSE. Last
post: Builder, then foreman. Hobbies: Pending.):

> Hello. This unit has arrived somewhere with a great many people in it. **[NEW]**  
> <sub>`beat.beyond-arrived` · 13w</sub>

(👋 12) mossy.lamp: he brought a FORM 😭 (📋 5) ThunderSoap: Welcome home, FUSE 💜 (🥰 8)

**#the-hangout.**

> You appear to be arguing about a game. **[NEW]**  
> <sub>`beat.beyond-arguing` · 8w</sub>

(😂 14) grumbleberry: we are DISCUSSING (💯 6)

**#jammin-out.** FUSE: Volume exceeds regulation. Leaving. (😂 4)

**#gearhead.** FUSE: Incident report filed on your behalf. Wear gloves. (⚡ 7, 🔧 3)

**#watch-me-grow.**

> Day 1.  
> <sub>`beat.beyond-day-1` · 2w</sub>

(🌱 21, 💜 27, 🥰 12, 🙏 9, 🍕 1) ThunderSoap pinned a message.

*The window folds back into the light. It settles over the hall, and gold floods it. Title card:*

**Title card.** FUSE went to ThunderClap Gaming. / He made friends. Loud ones. / He still has questions about your safety record. Buttons: Join ThunderClap Gaming · Leave a tip.

*Idle 30 s on the ending screen: the clipboard on the hall floor, one new line.*

> Day 1. Hobby: people. Monitoring.  
> <sub>`beat.post-credits` · 5w</sub>

## Empty sockets

**`gem:bend`**

> Bend socket. Bends are issued at the front desk. Everything is issued at the front desk. **[NEW]**  
> <sub>`socket.gem:bend` · 16w</sub>

**`gem:split`**

> Split socket. Splitter Mill. Split is a proud gem. It knows it. Don't encourage it. **[NEW]**  
> <sub>`socket.gem:split` · 15w</sub>

**`gem:amplify`**

> Amplify socket. The furnace keeps the Amplifies. The furnace went cold. It's still sulking about it. **[NEW]**  
> <sub>`socket.gem:amplify` · 16w</sub>

**`gem:gate`**

> Gate socket. The relay hands those out. Two signatures required. Bring a friend. You are the friend. **[NEW]**  
> <sub>`socket.gem:gate` · 17w</sub>

**`gem:capacitor`**

> Ice socket. Capacitor bay. Ice was cut last. Nobody remembers by whom. Nobody is looking into it. **[NEW]**  
> <sub>`socket.gem:capacitor` · 17w</sub>

**`storm:2`**

> Two rings. Wants a double charge. Storm Cell II makes those. Under a tarp. Someone put a tarp on it. **[NEW]**  
> <sub>`socket.storm:2` · 20w</sub>

**`storm:4`**

> Four rings. The whole storm. Roof array. The roof is very high. That is a fact, not a feeling. **[NEW]**  
> <sub>`socket.storm:4` · 19w</sub>

**`altar:8x6`**

> Wide socket. Bigger altar. The crane lifts the stones. The crane has a job. Good for the crane. **[NEW]**  
> <sub>`socket.altar:8x6` · 18w</sub>

**`altar:10x8`**

> Widest socket. The whole slab. That's booth business. Nobody goes in the booth. Regulation 3. **[NEW]**  
> <sub>`socket.altar:10x8` · 15w</sub>

## Reactions to a failed bolt

FUSE's quip follows the attempt's root fizzle, the same cause the verdict's "Try:" line names
(`reactionLine` in `lines.ts`). On the first failure he says the line about that cause; later
failures rotate through it and the generic lines for the outcome. A cause line is never said
without its cause. Cause lines are Tier 1 only, so in later tiers he keeps to the generic lines.
A breaker trip always gets an "over" line.

**Tier 1, root fizzle: a Bend facing away**

> Incident report #4,211: visitor set a Bend facing a wall. Outcome: wall remains unpowered. Visitor remains hopeful.  
> <sub>`reaction.facing.t1.1` · 17w</sub>

**Tier 1, root fizzle: any gem facing away**

> The charge knocked on the back of a gem. Nobody answered. The gem has other priorities. **[NEW]**  
> <sub>`reaction.facing.t1.2` · 15w</sub>

**Tier 1, root fizzle: empty socket**

> Empty socket. The charge stopped to ask directions. Nobody was there. Very on-brand for this facility. **[NEW]**  
> <sub>`reaction.empty.t1.1` · 16w</sub>

**Tier 1, root fizzle: ran off the altar**

> The charge left the altar and went into the floor. The floor is fully charged now. Nobody asked the floor. **[NEW]**  
> <sub>`reaction.ground.t1.1` · 19w</sub>

**Tier 1, root fizzle: carved stone**

> The charge met carved stone. Stone won. Stone usually wins. Long career. **[NEW]**  
> <sub>`reaction.blocked.t1.1` · 11w</sub>

**Tier 1, root fizzle: odd charge into a Split**

> Odd charge into a Split. Can't split a spark. Someone tried once. The ceiling remembers. **[NEW]**  
> <sub>`reaction.odd-split.t1.1` · 15w</sub>

**Tier 1, root fizzle: a Gate with one input**

> One signature on a two-signature form. The Gate waited. Gates are patient. Not that patient. **[NEW]**  
> <sub>`reaction.gate-alone.t1.1` · 15w</sub>

**Tier 1, root fizzle: a gem already spent**

> Two charges, one gem. First come, first served. The second charge has filed a complaint. **[NEW]**  
> <sub>`reaction.spent.t1.1` · 15w</sub>

**Tier 1, dead**

> The charge went nowhere. Very calm about it. Regulation 4: nowhere is not a destination. **[NEW]**  
> <sub>`reaction.dead.t1.1` · 14w</sub>

**Tier 1, under**

> Machine felt that. Machine would like more of that. Machines are like that. **[NEW]**  
> <sub>`reaction.under.t1.1` · 13w</sub>

**Tier 1, over**

> Breaker. Too much. Generous, though. Incident report #4,211: visitor is generous. Monitoring. **[NEW]**  
> <sub>`reaction.over.t1.1` · 12w</sub>

**Tier 2, dead**

> Dead end. The charge knew. You'll know next time. That's how it went the first time, too. **[NEW]**  
> <sub>`reaction.dead.t2.1` · 17w</sub>

**Tier 2, under**

> Short. The gauge twitched. This unit twitched too. Sympathetically. Not a malfunction. **[NEW]**  
> <sub>`reaction.under.t2.1` · 12w</sub>

**Tier 2, over**

> Breaker again. It used to trip at three in the morning. Someone used to reset it. In slippers. **[NEW]**  
> <sub>`reaction.over.t2.1` · 18w</sub>

**Tier 3, dead**

> Nowhere. Again. I've… this unit has seen worse. **[NEW]**  
> <sub>`reaction.dead.t3.1` · 8w</sub>

**Tier 3, under**

> Short. Close, though. I used to… it's close. **[NEW]**  
> <sub>`reaction.under.t3.1` · 8w</sub>

**Tier 3, over**

> Breaker. I'll reset it. I always… the breaker resets itself. It does that now. **[NEW]**  
> <sub>`reaction.over.t3.1` · 14w</sub>

## Codex margins

**channel**

> Goes straight. Admirable. Most things here don't. **[NEW]**  
> <sub>`codex.channel` · 7w</sub>

**bend**

> Facing a wall counts as a choice. A poor one. See incident report #4,211. **[NEW]**  
> <sub>`codex.bend` · 14w</sub>

**split**

> Split's proud of this. Don't tell it the halves are smaller. **[NEW]**  
> <sub>`codex.split` · 11w</sub>

**amplify**

> Greed trips breakers. Regulation 5. Regulation 5 has seen things. **[NEW]**  
> <sub>`codex.amplify` · 10w</sub>

**gate**

> Two signatures or nothing. Regulation 9. Bureaucracy, but glowing. **[NEW]**  
> <sub>`codex.gate` · 9w</sub>

**capacitor**

> Stores a charge for later. Ice stores things. That's what ice is for. **[NEW]**  
> <sub>`codex.capacitor` · 13w</sub>

## At the altar

Heard at the altar itself, not in the hall. Written for the altar in the same voice.

**Exact solve** (the verdict card when a machine wakes; one per tier, `exactLine(tier)`)

> Exactly right. Look at it go. Paperwork can wait. **[NEW]**  
> <sub>`exact.t1` · 9w</sub>

> Right on the number. Management would call that adequate. Management is wrong. **[NEW]**  
> <sub>`exact.t2` · 12w</sub>

> Exact. Not a spark wasted. I've signed worse. **[NEW]**  
> <sub>`exact.t3` · 8w</sub>

> Exact. Mind the door on your way through. **[NEW]**  
> <sub>`exact.t4` · 8w</sub>

**Teach nudge** (idle on Intake Desk, `TEACH_NUDGE`)

> Gem from the tray. Onto a bright socket. Wrong spot? Pick it up again. The form allows this. **[NEW]**  
> <sub>`nudge.teach` · 15w</sub>

**New-gem nudges** (the first altar that shows the gem, said when FUSE is free and skipped once the gem is in use, `gemNudge(gem)`)

> Plain blue. In one side, out the other. Like the paperwork. **[NEW]**  
> <sub>`nudge.channel` · 11w</sub>

> New gem on the altar. It has opinions about straight lines. **[NEW]**  
> <sub>`nudge.bend` · 10w</sub>

> Amplify on the altar. Handle it like the meter is watching. **[NEW]**  
> <sub>`nudge.amplify` · 10w</sub>

> Split's on the altar now. It's been waiting all morning. **[NEW]**  
> <sub>`nudge.split` · 10w</sub>

> New one on the altar. It won't work alone. Nobody here does. **[NEW]**  
> <sub>`nudge.gate` · 12w</sub>

> Ice on the altar. I'd use it. Eventually. That's rather the point. **[NEW]**  
> <sub>`nudge.capacitor` · 12w</sub>

## Rule and verdict copy (mobile-6-moments)

Not FUSE's voice: the plain rule text the player reads on gem cards, chips, the Codex and the
verdict. "Charge" is the one noun for what flows; the untaught "bolt", "fizzle", "stem",
"arms", "joined sides" and "sparks" are gone. FUSE's lines above are unchanged, and no rule
depends on them. Source: `content/codex.ts` (rule, chip, maths), `scenes/altar/strike.ts`
(`CAUSE_TEXT`, `CAUSE_HINT`, `nextStep`), `scenes/altar/altar-scene.ts` (`NO_TURN`,
`RING_RULE`, the teach card's buttons).

| Where | Line |
|---|---|
| Codex footer | The numbers are charge. A storm gives 4 a strike; 2× gives 8, 4× 16. |
| Channel | Carries the charge straight through, whichever way it enters. The charge is unchanged. · chip: Carries the charge straight through, unchanged. · `out = in` |
| Bend | Turns the charge round the corner along its bent line, either way. Charge entering any other side is lost. · chip: Turns the charge along its bent line. Other sides lose it. · `out = in, round the corner` |
| Split | Charge enters at the plain end and leaves by both arrows, half each. Odd charge, or charge from any other side, is lost. · chip: In at the plain end, half out each arrow. Odd or wrong side: lost. · `4 → 2 + 2 · odd → lost` |
| Amplify | Doubles the charge, once per path. Charge that has already passed an Amplify, even split since, goes through unchanged. · chip: Doubles the charge, once per path. Already doubled: unchanged. · `4 → 8 · 8 → 8 (already doubled)` |
| Gate | Both ports, same strike: the sum leaves by the arrow. One port alone, or charge at the back, is lost. · chip: Both ports, same strike: the sum leaves by the arrow. · `out = a + b, only if both arrive` (teach-7: one sentence on the codex, the chip and the teach card) |
| Capacitor | Stores the first charge it gets; nothing comes out. Next strike, the new charge pushes both out together, straight on. · chip: Stores its first charge; next strike, lets out both. |
| Ring (teach) | A socket the charge must reach. Set a gem there. |
| Can't turn | Can't turn: charge goes straight through |
| Causes | Empty socket: charge lost · Carved stone: charge lost · Charge ran off the altar · Turned the wrong way: charge lost · Odd charge can't split: lost · Gate needs both ports fed on the same strike · Gem already used this strike |
| Try lines (changed) | Try: lead the charge to the machine before it runs off the altar. · Try: feed the Gate's other port on the same strike. · Try: give each path its own gems. A gem carries charge once per strike. · (touch) Try: turn the gem at the red mark (↻ Turn). |
| Teach card | New here · 1 of 3 · Next › · Got it |
