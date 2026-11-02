# The Last Rune — Design Pitch v0.3 (canonical source)

> Imported verbatim (text only) from the ThunderClap design-pitch artifact on 2026-11-02. This is the source of truth for design intent. Deviations are logged in `docs/DECISIONS.md`, not edited in here.

```text
The Last Rune — ThunderClap Gaming pitch document v0.3
ThunderClap Gaming
Design pitch · standalone one-week game · v0.3
Free on itch.io · tip jar · browser build · first game on the ThunderClap engine
November 2026
Art direction
Alive, painterly, jewel-toned
The reference is casual-fantasy painterly: chunky faceted gem runes that glow from inside, hand-carved stone with grain and chips, warm candlelight bouncing off cold stone, mist rolling at floor level, embossed gold-and-amethyst lettering. Nothing is a flat line. Every surface has a material, every light source has a colour, and the palette is saturated on purpose.
Palette
Channel · cyan
Bend · amethyst
Split · magenta
Amplify · amber
Gate · emerald
Capacitor · ice
Stone · slate
Shadow · ink
Candle · warm
Emboss · gold
Parchment
Mist
Runes are gems, not glyphs
Each rune is a faceted crystal with a glyph lit from inside. Colour is the rune's identity, so the live path takes the colour of the last rune it passed. Routing becomes a ribbon of changing light.
Stone has grain
Tiles and walls are rough-hewn, with chipped edges, moss, and tool marks. The puzzle slab is a carved altar, not a grid.
Two light families
Cool gem glow and warm candlelight are always both present. Warm comes from the edges (lamps, potions, FUSE's eye), cool from the centre (the runes). Where they meet, the scene feels alive.
WebGPU earns its keep
Bloom on emissives, volumetric floor mist, refraction inside gems, thousands of spark particles, screen-space god rays from the storm. The storm cell is a real crackling fluid, not a sprite.
Rune gems
1 · Overview
The Last Rune
Genre
Gem-circuit puzzle
Length
16 machines · ~1 hr
Platform
Browser · WebGPU
Price
Free · tip jar
The hook
Runes are gemstones that carry lightning. Set them into a carved stone altar so a captured bolt flows from the storm cell to a dead machine at exactly full charge. Each machine you wake hands you a new gem, and each gem unlocks machines you couldn't touch before. The last one needs everything.
Why this one, this week
Fully standalone: its own art, code and tone, a miniature complete experience.
First game on a new engine/ folder, so the week also produces the seed of our shared engine.
Thunder and lightning are already the ThunderClap identity.
Finished means finished. No roadmap, a clean itch page and a tip jar.
Core loop
Pick an unlocked machine
Set gems, route the bolt
Machine wakes, gem granted
New machines unlock
Gem set (v1)
Channel — carries charge straight through
Bend — turns it 90°
Split — two outputs at half charge
Amplify — doubles charge, once per path
Gate — fires only when both inputs are live
Capacitor — stores a bolt, releases on the next
One rule: a machine wakes at exactly full charge. Too little does nothing. Too much trips the breaker.
Scope guards
One mechanic. Progression is gem gates, not stats.
No inventory, no combat, no VR in v1
Codex reachable from every puzzle, always
Story told by FUSE and the environment, zero cutscenes
Engine folder gets only what this game actually uses
2 · Progression: gem gates
16 machines · 3 branches · 1 convergence
Every machine is locked behind one or two capabilities and grants one when restored. Capabilities are gems, storm-cell strength, or altar size. Locked doors show the gems they need as empty sockets, so the player always sees two or three open doors and knows exactly why the others are shut.
Capability types
Gems (Bend, Split, Amplify, Gate, Capacitor). Storm cell strength (1×, 2×, 4×). Altar size (6×4, 8×6, 10×8).
Always a choice
At least two machines are unlocked at any time. Stuck on one? Solve the other, and the new gem usually reframes the first.
Locks are readable
A locked door shows empty gem sockets in the colour it needs. FUSE adds the commentary. No hidden gates, ever.
3 · Your guide: FUSE
Foreman Unit, Slightly Expired
FUSE is the tutorial, the hint system and the story. He's been alone in the factory for forty years, keeps a safety record nobody asked for, and treats every mechanic as a regulation. He's riveted brass and iron, one eye glowing warm amber, the other long dead. His light is the warm light in every scene.
He also narrates the locks. Every empty socket on a door comes with a reason, usually a grudge. He deflects with jokes until the final machine, then admits he was told to keep the lights on until someone came back, and that he assumed they meant Management.
Voice
Dry, procedural, quietly thrilled to have company.
Running gags
Counts the days. Files incident reports on you. Hates drawers.
Sample lines
"Welcome to the facility. Start with the intake desk: the gold doorway. Mistakes cost nothing here. Management made sure. Management made a lot of them."
"Press Unit 4 wants a magenta and an amber. Regulation 12. I wrote Regulation 12. I was having a day."
"Incident report #4,211: visitor set a Bend facing a wall. Outcome: wall remains unpowered. Visitor remains hopeful."
"Storm's coming. Good. We're a lightning factory. Rain would be awkward."
4 · Story
Short, funny, and then it isn't
The twist. Forty years ago the Builder couldn't finish the Last Rune in a human lifetime. So they uploaded themselves into the foreman unit to keep the lights on until someone came. The upload took the skills and the stubbornness and lost the name. FUSE is the Builder. FUSE doesn't know. The player works it out two machines before he does.
Why it works in an hour
Every joke is also a clue. The incident reports are memories leaking out as paperwork. "Management" is the committee that told the Builder to stop. The drawers he resents are his own desk. Nothing needs a cutscene; the player just hears the same lines differently on the way back.
The clue ladder
1. He knows every solution but can't place gems. 2. Journal handwriting matches his report font. 3. He quotes a page he says he never read. 4. The Builder's last entry is dated the day his day-count started. 5. He says "I" instead of "the Builder" and stops mid-sentence.
The shape
Tier 1 is pure comedy. Tier 2 the jokes get specific in ways a robot shouldn't manage. Tier 3 he gets quiet and fast. The Last Rune he says nothing at all until you set the final gem. Then one line.
The door
The Last Rune was always a door, and it was always for him. It opens onto somewhere with people in it. Specifically, our Discord. He walks through. The game ends with a real invite and a robot who has questions about your safety record.
Rules for the lines
Two lines per machine: one on arrival, one on solve. A few locked doors get a third. Nothing over twenty words.
FUSE never explains a mechanic twice. The codex does that. He reacts.
He is never mean to the player. He is mean to drawers, Management, and the concept of rain.
Journal pages are in the Builder's voice and rhyme with something FUSE said in the same tier.
The word "I" is rationed. Count them. They go up.
Script · Tier 1
Comedy. Zero "I".
TITLE · the door is knocked on
"Oh. Someone's at the door. Nobody's at the door. Nobody's been at the door for forty years."
INTAKE DESK · grants Bend
Arrive: "Day 14,610. A visitor. There's a form for that. Take a rune from the tray, set it on a lit socket. You can't break anything. Others have tried."
Solve: "Regulation 1: the hallway rune. Regulation 2: this unit does not do a victory noise. Bzzt. That wasn't one."
FURNACE · grants Amplify
Arrive: "The furnace. Went cold the week Management left. Everything did. Unrelated."
Solve: "Amber rune doubles the charge. Stack two and the second one just feels important. Like a deputy foreman."
SPLITTER MILL · grants Split
Arrive: "Splitter Mill. Takes one thing and makes it two smaller things. Management loved it. Management loved committees."
Solve: "Half and half. Like this unit's optimism. Incident report #4,211: visitor appears competent. Monitoring."
RELAY TOWER · grants Gate
Arrive: "The relay. Needs two full signals to pass one. Two signatures. Regulation 9. Nobody remembers who signed."
Solve: "Emerald. Good. Regulation 8: don't ask where Management went. Regulation 8 is new. Regulation 8 is for you."
CONVEYOR A · no gem · 1× bolt check
Arrive: "Conveyor A. Carried parts to the big one. Then carried them back. Then stopped. Very relatable machine."
Solve: "Moving again. The sound it makes. That's… a sound. Carry on."
Locked-door lines (Tier 1): "Needs a magenta. Regulation 12. Someone wrote Regulation 12 while having a day." · "Needs a double bolt. Storm Cell II. It's upstairs. Everything important is upstairs." · "Needs the crane. The crane needs the relay. The relay needs patience. Everything here needs something."
Journal, Tier 1 (Builder): "Intake desk reopened. First visitor in a month. Committee again. They brought forms." · "Furnace runs hot enough for everything except the one thing I built it for." · "Split the team in two. Half stayed. Half were right."
Script · Tier 2
The jokes know too much. "I" appears.
PRESS UNIT 4 · needs Amplify + Split
Arrive: "Press Unit 4. Sulking since the committee. The trick is amber before magenta, never after. Not that anyone asked. Nobody asks."
Solve: "Amber before magenta. Told you. Didn't tell you. Thought it loudly. Incident report: visitor hears thoughts. Monitoring harder."
STORM CELL II · needs Split · grants 2× bolt
Arrive: "Second storm cell. Double the bolt. The committee said it couldn't be built. The committee also said that about the first one."
Solve: "Two bolts. Both my eyes are on. That hasn't happened since… it's dust. There's dust. Forty years of it."
Tarp comes off: "That's not on the floor plan. It's checked daily. It's a lot of checking. Someone drew that from memory."
CRANE · needs Gate · grants 8×6 altar
Arrive: "The crane. Lifts the big stones. Hands are overrated. This unit has clamps. Clamps can't hold a gem. Noted. Resented."
Solve: "Bigger altar. More sockets. More ways to be wrong. Ask me how I know. Don't. Regulation 8."
BOILER ROOM · needs 2× bolt
Arrive: "Boiler room. The Builder slept here, toward the end. There's a cot. It's a very specific cot. Nobody told this unit that."
Solve: "Warm. First time it's been warm in here since… the cot's facing the wrong wall. It always was. Why would that be known."
ARCHIVE · needs 8×6 altar
Arrive: "The archive. Drawers. Nothing but drawers. Can't open a single one. Had a long time to resent drawers. Regulation 14 is about drawers."
Solve: "You've read the pages. This unit hasn't. 'They say nothing on this floor runs hot enough.' That's page four. How is that… Regulation 8. Regulation 8."
FOUNDRY · needs Amplify + Gate
Arrive: "Foundry. Where the gems were cut. The magenta ones never came out right. Too proud. Cut them anyway."
Solve: "I cut… the foundry cut six hundred gems. Six hundred and twelve. Why is that a number this unit has."
Journal, Tier 2 (Builder): "Amber before magenta. Wrote it on the wall so I'd stop forgetting." · "Moved the cot to face the big one. If it wakes up at night I want to see it." · "Six hundred and twelve gems. The magenta ones are too proud. Keeping them anyway." · "The committee came with a shutdown order. I signed it. I didn't say when."
Script · Tier 3 and the Last Rune
Quiet, fast, then one line
CAPACITOR BAY · needs 2× bolt · grants Capacitor
Arrive: "Capacitor bay. Stores a bolt for later. The committee said that was cheating. It is. Do it anyway."
Solve: "Ice rune. The last one I… the last one that was cut. Didn't get to use it. Someone didn't. Monitoring self."
LIFT SHAFT · needs Capacitor
Arrive: "Lift to the roof. Hasn't run since the day the counting started. Day one. The count started for a reason. Can't find the form."
Solve: "Going up. I don't like heights. This unit doesn't have a setting for heights. So where did that come from."
ROOF ARRAY · needs 8×6 + Gate
Arrive: "The roof. The storm's right there. Forty years it's come every night and found nobody home. Tonight it's looking at you."
Solve: "Array's live. The whole sky's wired to the floor now. Management said keep the lights on until someone comes back. I assumed they meant them."
CONTROL BOOTH · needs everything but the Last Rune
Arrive: "The booth. The Builder's chair. Nobody sits in it. It's… it's adjusted. For a unit this height. That's a coincidence. Regulation 8 covers coincidences."
Solve: "Page sixteen. Last page. Dated the day the count started. I haven't read it. I know what it says. I know what it says."
Journal, page 16 (Builder): "It can't be finished in a lifetime. Fine. I'll stop having one. The foreman unit has room. If this works, it'll keep the lights on and it won't remember why, which is a mercy. If someone comes: tell it the drawers were mine. Tell it the count can stop. — signed, and then the signature trails into the same hand as every incident report."
THE LAST RUNE · needs everything
No line on arrival. No line while you work. The corner card is empty for the first time in the game. Only when the final gem is set:
"Incident report, final. Visitor completed the facility. Foreman unit is going to need a new hobby. Foreman unit has had one hobby for forty years and it was this, and it was mine, and it's done."
"Go on. I'll get the lights."
The rune catches the storm. It was always a door. The player walks toward it. FUSE doesn't move.
"Oh. It's not for you. Is it."
Script · The door
Corny on purpose. Earned.
BEAT 1 · he goes through
FUSE rolls to the edge of the gold light. Stops. Clipboard still in his clamp.
"Forty years keeping a door lit for someone to come home through. Should've checked who was on the list."
"You'll want the forms. They're in the drawers. Turns out I had a key the whole time."
He drops the clipboard. It lands on the floor. He goes through. The screen goes white.
BEAT 2 · the other side
White fades to a very different kind of screen: a chat window. Dark theme, familiar layout, a channel list down the side. A cursor blinks in a channel called #this-will-break. Then, slowly, typed:
FUSE: hello. this unit has arrived somewhere with a great many people in it.
FUSE: you appear to be arguing about a game.
FUSE: day 1.
Beat. A second line of avatars lights up as "real" members react. If online, the actual Discord widget replaces the mock here, with real messages.
BEAT 3 · the invite
The chat window shrinks into the ending screen. Gold floods the hall. Title card:
FUSE lives in the ThunderClap Discord now.
He has questions about your safety record.
Two buttons: Join ThunderClap and Leave a tip. Below, small: "This was the whole game. Thank you for finishing it."
Making it real, not just corny. FUSE becomes an actual bot in the Discord, same voice, same regulations. He greets new members with an incident report. He counts days. Anyone who finishes the game and joins gets a "Visitor" role and one line from him that references their play time. The door in the game points at a door that is actually open, and the joke keeps running where the community already lives.
Optional post-credits, if someone idles on the ending screen for thirty seconds: the clipboard on the factory floor flips a page by itself. New entry, same handwriting. "Day 1. Hobby: people. Monitoring."
5 · Screens
Browser 16:9 · target look
1 · Title. A stone chamber, candle and potion light on the walls, the six gems heaped on the altar with mist curling through them. Gold embossed title with amethyst shadow. One gold Play button.
2 · Factory hall. Torch-lit stone, machines in carved alcoves. Restored alcoves hold a lit gem, the unlocked one glows gold with an empty socket in the colour it will grant, locked ones show dark dotted sockets and a padlock. Cyan conduits run along the floor between what you've woken. Mist pools under everything.
3 · Puzzle. A carved altar with round sockets instead of a grid. The bolt is a ribbon of light that takes the colour of each gem it passes, so a solved path reads as a rainbow of your choices. The storm cell is a brass-ringed crackling core, the machine a riveted iron box with a real gauge. Gems in the tray are cut stones; the chosen one lifts and lights the tray. Candles at the edges, mist at the feet.
4 · Codex. An open leather tome with brass corners, laid over the dimmed altar. Each gem sits in a carved stone niche on the page with a live glow, its rule in ink, the maths beneath, and FUSE's note in the margin. Gems you haven't earned are an empty chained niche naming the machine that teaches them.
5 · Solve moment. The bolt lands through the ceiling, the iron machine blazes cyan, sparks fall, the gauge pins at 100%. The solved altar sits small at left showing its rainbow path. A new gem badge slides in on a gold plate and names what it unlocks. A parchment journal page lands bottom-left.
6 · Journal. A wooden desk under one candle. Found pages stack at left, the selected one spreads open at right in the Builder's ink. FUSE's rebuttal is a brass-tacked dark plate at the bottom. Inkwell, quill, grain in the wood. The warmest screen in the game.
7 · Ending. The storm funnels into the Last Rune, a room-sized gold disc at the centre of the hall. Every alcove glows its own gem colour and gold floods a world that has been cool blue the whole game. FUSE's last report, a gold tip jar, a Discord link, done.
6 · The engine folder
What a ThunderClap engine should start to look like
Two top-level folders. engine/ holds only things with no idea what a gem is. games/last-rune/ holds everything that does. The promotion rule: used by this game, plausibly by the next, zero game nouns in the API. The painterly look lives in the engine as a post stack (bloom, fog, god rays, particles) the next game inherits for free.
thunderclap/
├─ engine/
│ ├─ core/ loop, time, events, ecs-lite
│ ├─ render/ WebGPU device, sprite+mesh
│ │ batch, material system
│ ├─ post/ bloom, volumetric fog,
│ │ god rays, vignette, grade
│ ├─ fx/ GPU particles, trails,
│ │ light flicker, emissive pulse
│ ├─ input/ pointer, keys, gamepad,
│ │ action-map (no bindings)
│ ├─ audio/ buses, one-shots, loops
│ ├─ ui/ panels, buttons, toasts,
│ │ overlay stack, theme tokens
│ ├─ save/ versioned slots, migrations
│ └─ platform/ canvas mount, resize,
│ itch + Fly boot
└─ games/
└─ last-rune/
├─ rules/ gems, charge sim, gates
├─ content/ machines.json, lines.json,
│ puzzles/, journal/
├─ scenes/ title, hall, altar, codex
├─ art/ stone, gems, FUSE, pages
├─ shaders/ storm cell, gem refraction
└─ main.ts
Goes in engine/ this week
Game loop, WebGPU batch with a simple material system, the post stack (bloom, fog, god rays, grade), GPU particles, pointer input, audio buses, overlay stack for codex-style panels, versioned saves, itch and Fly boot.
Stays in the game
Gem rules and the charge sim, the capability graph, every scene, FUSE's lines, all art, the storm-cell and gem-refraction shaders. Anything with "gem" or "machine" in its name.
Deliberately not yet
3D scenes, VR, physics, networking beyond fetch, an editor, scripting. The next game earns those by needing them.
The engine is a by-product of shipping, never the project.
7 · The week
Ship Friday to #this-will-break
Mon
engine/: loop, WebGPU batch, post stack, input, save. Altar, sockets, charge sim. Fly volume.
Tue
Six gems with refraction shader, breaker rule, capability graph. 16 puzzles roughed against the map.
Wed
Stone hall, alcoves, sockets and conduits, codex tome, journal desk. FUSE lines.
Thu
Mist, candles, storm cell fluid, particles, solve moment, ending. Playtest two friends.
Fri
Itch page, devlog, drop in #this-will-break. Ask for ratings. Tag engine/ v0.1.
ThunderClap Gaming
The Last Rune · design pitch v0.3 · internal
```
