# CircuitBuilder v0.19.0 — Evolution Lab v0.7: Living Settlements & Construction

**Civilizations build themselves.** Lab 04's inhabitants now collect construction
materials, discuss real settlement needs through their individual circumstances,
choose actual land locations, contribute construction labor and eventually
move their households into completed residences. Gods can influence their lives
without manually placing every building.

## Try Evolution Lab v0.7

1. Open **04 Evolution Lab → SETTLEMENTS** after communities form. Select a
   settlement to inspect its full local map, culturally distinctive buildings,
   owned land, material stocks, paths, residents and households with homes.
2. Use **PLAY WORLD** or **+10 YEARS** while viewing the city. Watch a shelter,
   house, farm, storehouse, well, workshop or communal hall progress through
   foundation, framing, finishing and completion; unfinished projects show their
   real material deliveries and labor hours. Completed buildings may later be
   abandoned or decay into ruins.
3. Switch to **WORLD**. Zoomed-out settlement icons reflect actual completed
   structures and population; zoom in far enough to see little local building
   sprites and worn paths. Select the town center or a building tile and click
   **VIEW LOCAL CONSTRUCTION** to inspect the whole built environment.
4. Export a world JSON file and re-import it. Households, buildings, histories,
   construction stages, land claims, path wear, and ruins all survive unchanged.
   Older saves remain valid and start tracking real construction after advancing
   time. No buildings are retroactively invented for the past.

## How it works

- Each settlement owns bounded habitable terrain. Residents score project
  priorities from actual housing needs, food security, population and career or
  value preferences. Location selection values site safety, terrain suitability,
  existing roads, nearby resources and distance from the center.
- Construction uses separately tracked wood, stone, clay and available labor.
  Materials are gathered by residents from the settlement's actual biome mix.
  Artisans and healthy motivated citizens provide different labor amounts;
  workshops improve productivity. Progress reflects **delivered resources plus
  labor**, rather than a decorative animation timer.
- Finished shelters/houses receive specific household occupants. Farms improve
  nearby food; storage buildings increase material capacity. Buildings have
  condition, abandonment dates and ruin states; collapsing communities leave
  physical ruin sites for later generations to inspect.
- Trails are derived from **actual agent movement events**, with travel wear
  accumulated and faded over time. Roads do not appear from manual drawing.
- Architectural palettes differ across humans (timber), elves (living wood),
  dwarves (masonry) and demons (basalt). Settlement stages—encampment, hamlet,
  village, town, city—are calculated from real buildings and resident counts.
- Simulation time, economy and construction happen **only in the world tick**.
  Visual zoom, opening an inspection panel, or viewing another settlement cannot
  advance, delay or change any economic or demographic result. Playback may
  continue while the Settlements screen is open.

### Current limitations

These are rule-driven decisions, not an external generative AI planning every
building. Material production abstracts extraction into annual harvests rather
than simulating individual trees and quarry blocks. Only one world tile is used
per building; detailed interiors, markets, taxation, roads between cities,
animal agriculture and multi-story construction are future expansions. The
existing 850-person cap still applies.

---

## Previous: Evolution Lab v0.6 — Divine Powers & Mortal Agency

**The creator can intervene; mortals still make choices.** Evolution Lab 04 now
has a **DIVINE POWERS** tab with unrestricted sandbox abilities in three groups:

- **Influence:** whisper inspiration about exploration, leadership, learning,
  cooperation, faith or personal goals. A target uses inherited temperament,
  trust and learned values to accept, resist or reinterpret the message. Accepted
  or reinterpreted whispers affect actual intentions and development for a
  chosen number of years. Hunger, danger and dependent children take priority.
- **Blessings & Debuffs:** modify health recovery, effective lifespan, fertility,
  skill growth, intelligence, luck, courage and social behavior. Apply negative
  or positive modifiers for a set number of years, permanently, or hereditarily.
  Hereditary blessings and family curses propagate to descendants with a small
  generational dilution. An individual can carry several effects simultaneously.
- **Direct Intervention:** heal, punish, resurrect a deceased identity, summon a
  member of any people or transform a chosen terrain tile. Actions have no
  cooldowns or divine currency. Safety rules still protect world-file validity,
  occupancy and the browser's 850-person cap.

### Try v0.6

1. Open **04 Evolution Lab → DIVINE POWERS**, choose a living person and give
   them a hereditary fertility blessing. Advance time and open **PEOPLE** to
   trace the inherited divine source IDs in children and grandchildren.
2. Send two individuals a dream about exploration or leadership. Read each
   person's response in the divine chronicle and watch their subsequent goals.
   An individual can resist the suggestion; direct edits always take effect.
3. Try heal, punishment, resurrection, summoning and terrain changes. Explore
   different cultural readings of each event in **DIVINE INTERVENTION HISTORY**.
4. Existing v0.1–v0.5 saves still import. Divine history starts at the first
   actual intervention; the simulator does not invent earlier miracles.

### Population balance

Humans now have somewhat higher fertility, modestly longer lives and lower
metabolic demand. Demons have a stronger fertility buff, lower metabolism and
slightly longer lives to offset low-food volcanic and wasteland settlements.
When either population falls below 65, paired families can receive a measured
recovery bonus. **This is not a species guarantee:** famine, disasters of
ordinary ecology, overcrowding and extinction remain possible. No race receives
immunity or fabricated births; physical births still require real healthy
partners and free terrain. The 850-person cap remains globally shared.

### Limits and transparency

- Minds use deterministic, explainable rules—not LLM calls or consciousness.
  Faith and cultural interpretation are the groundwork for emergent religion,
  not a full religious or political institution system yet.
- Powers create documented effects. Resurrection renews a body but preserves the
  person's original identity and earlier family chronology. Temporary effects
  expire; permanent and hereditary ones survive saves and world ticks.
- Sandbox has unrestricted *choice of powers*, with validation to keep saves
  playable. Water cannot be created under a living occupant; resurrection and
  summoning require free habitable space. Consequences follow the simulation.

---

## Previous: Evolution Lab v0.5 — Childhood, Memory & Social Development

**It takes a village.** Children are no longer miniature adults with only smaller
energy costs. Infants depend on nearby adult caregivers; children and adolescents
can receive care, mentorship and shelter from households and neighbors, including
other species. Different childhood circumstances change learned skills, trust,
resilience, relationships, languages and values without forcing a moral identity.

## Try v0.5

1. Open **04 Evolution Lab → PEOPLE**, follow a young person, and inspect the new
   **Upbringing & Social World** section. It shows one of five species-scaled life
   stages, caregivers, adoption, mentors, friends, the active household, skills,
   personal values, emotional development, known languages and formative memories.
2. Advance time and compare two children from the same species. Care, social
   contact, instruction, discoveries and lack of support create different
   opportunities, adult careers and memories. Individuals can leave their family
   household after reaching maturity, without severing kinship records.
3. Watch an explorer's **current intention** in the World Inspector. Healthy,
   curious adults now plan expeditions to land-reachable waypoints beyond their
   familiar biome; discoveries increase navigation experience. Travelers can
   retreat to suitable terrain when health or energy becomes unsafe. Water still
   blocks travel; bridges, ships and intercontinental routes are future work.
4. Older v0.4/v0.3 world JSON files continue to load. Newly tracked social
   experiences begin with the first advanced year: the simulation does not invent
   earlier childhood memories, households or historical adoptions.

### What is simulated (and what is not)

- Five life stages scale to inherited maturity and lifespan. Adult care transfers
  *real energy*; young dependents without nearby support face greater health
  risks, while neighboring adults can help even without biological kinship.
- Households are active family/care groups, **not yet placed buildings**. Shelter
  reflects nearby communities and present household caregivers. Adoption is a
  voluntary simulation choice influenced by social tendencies and circumstances.
- Friendships, apprenticeship, profession choices, cultural exposure, languages,
  skills, dispositions and values arise from events in the simulation. These are
  rule-based, deterministic systems, not generated dialogue, conscious AI or
  a learned neural model. No one is labeled a future villain or hero.
- Careers establish focus and skill growth, not full employment markets, wages,
  governments, schools, religion or warfare. Those can build on these records.
- The browser's 850-person safety cap remains. Species extinction is still
  possible, particularly in long-running worlds or harsh ecologies; v0.5 does
  not guarantee eternal survival or treat cultural difference as biological fate.

## Previous: Evolution Lab v0.4 — Mind Engine I

**Autonomous intentions and a population-cap fairness fix.** In Lab 04,
individuals now select goals from their actual conditions: search for food,
move away from unsafe terrain, seek family or potential partners, stay with
their partner, or explore. An individual profile and the World Inspector show
their current goal and reason. Minds remember recent locations where food was
scarce or plentiful, and use this information when seeking safer foraging.

## Try v0.4

1. Open **04 Evolution Lab** and click an individual on the map. Watch **CURRENT
   INTENTION** change as you advance years. You can inspect the same goal and
   remembered scarcity in **PEOPLE**.
2. Explore a harsh world using World Creator with **Resource Level** near 0.5.
   Individuals with insufficient food should pursue better foraging areas;
   survival is not guaranteed.
3. Run several worlds for 300+ years and inspect **History → Population Health**.
   In v0.3, the global 850-person browser performance limit let the *oldest*
   partnerships attempt births first. Long-lived peoples could hold this
   priority for centuries, causing shorter-lived species to disappear even
   with abundant food. v0.4 uses a seeded randomized queue for **all partner
   couples** instead. This removes the age-of-partnership monopoly while
   retaining real mortality, reproduction checks, and the overall cap.
4. Continue an existing v0.3 saved world without resetting it. New minds are
   initialized when the world advances. The version-2 world-file schema and
   deterministic replay remain intact; a changed simulation algorithm will
   naturally produce a different future timeline after upgrading.

### Scope

- This is an explainable, deterministic **utility-based simulation**, not an
  LLM controlling every character or learned neural network. Goals influence
  movement and relationships; actual births, deaths and memories are observed
  events, never invented narrative text.
- Agent minds contain only a current intention, target and a couple of bounded
  place memories; they are validated on import and saved with the existing world.
- There is no species immunity, forced survival quota, or automatic rescue.
  Extinction can still occur in unsuitable or resource-poor worlds.
- Jobs, governance, beliefs, persistent social memories and richer childhood
  development are future milestones.

## Previous: Evolution Lab v0.3 — People, Favorites & Divine Codex

**This is the identity-and-discovery release.** Every individual now has a fantasy name and family house, favorite people can be followed across death and generations, and important life events are recorded as part of the deterministic world simulation.

## Try v0.3

1. Open **04 Evolution Lab**, select **PEOPLE**, and search by name, house, species/ancestry, or numeric ID. Filter by living, deceased or favorites, with a species filter. Select someone to open their profile.
2. **Rename** a person (up to 64 safe characters), add/remove their **favorite star**, **Find on Map** (living individuals), or **View Family Tree**. Renames and favorites are stored in the world file, not a separate UI-only list.
3. Open **FAMILIES** from the navigation or an individual's profile to see parents, grandparents, children, siblings, partners, and a chronological **personal history**. People now appear by name in every family card, with their immutable IDs available for unambiguous tracking. Clicking a relative navigates to their record.
4. Open **✦ DIVINE CODEX** for bookmarked people, family houses, known settlements, historical ruins, and recent world events. Search settlements, follow places and rename active settlements. The **Find Location on Map** action works for historical locations, too.
5. Let the world advance. Individuals acquire recorded milestones through **courtship, partnerships, children, death and settlement founding**. A death does not erase a person's record; you can still favorite and rename deceased people.
6. Export a world JSON file or rely on the existing compact browser autosave. The schema remains v2, so v0.2 and v0.2.1 world files are accepted. Their unnamed people receive stable display names derived from existing seed+ID, while we **do not fabricate unrecorded childhood events**.

## Design constraints

- **Reproducible names, not RNG side effects.** Given names and family houses come from separate deterministic hashing using the immutable world seed and individual ID, so merely enabling identities never changes simulation outcomes. Children inherit their parent's house even when their mixed ancestry gives them a different dominant species.
- **Persistent individual biographies.** New inhabitants have an arrival/birth milestone; interactions append traceable, event-driven records. The current model tracks up to 40 personal moments per retained individual, with the earliest preserved. Related-individual links open real ancestry records rather than fictitious prose.
- **Durable favorites.** Bookmarking a person also protects them and their immediate parents from the long-term lineage-pruning pass. Favorites are capped at 100 people and 100 places per world.
- **Settlement archives.** Newly founded places have a lasting name, location and founding record. Their archives remain after abandonment, including a collapse year. Pre-v0.3 places still active when you upgrade will be registered on the next annual tick, but pre-upgrade collapsed towns cannot be reconstructed from missing data.
- **Bounded histories.** Up to 1,000 settlements can be retained in the settlement archive, 14,000 normal lineage records plus saved favorites, and the latest 90 major world events. Earlier unrecorded experiences are not invented.
- **No fake AI.** Generated names and narratives describe *real state transitions in the rule-based simulation*. Personalities, autonomous goal-oriented minds, real jobs, governments, religions, and divine blessings are still future milestones.

## Development

\`\`\`bash
git pull origin main
npm install
npm run dev
npm test
npm run build
\`\`\`

---

## Previous releases

# CircuitBuilder v0.14.1 — Evolution Lab v0.2.1: Population Stability

**This is a balancing and diagnostics release**, not a new civilization system. It targets the problem of humans, dwarves and demons dying before multi-generational societies can form. Four separate species still differ in maturity, fertility, lifespan, territory and habits; harsh worlds may still face extinction.

## What changed

- **Real ecological foraging:** An individual can gather food from its immediate 3×3 neighborhood, not just from the tile it stands on. All gathered resources are withdrawn from tiles, and regrow at biome-specific rates. Harsh mountain, cavern and scorched-borderland biomes now have improved—but still lower than forests—productivity.
- **More sustainable energy budgets:** Metabolic demands depend on maturity, terrain compatibility, food intake, and age. Children have smaller food needs; modest aid from nearby adults can help hungry young people. Food scarcity still causes genuine health damage and eventual death. There is no invented illness mechanic yet.
- **Population replacement:** Courtship develops more consistently; partnered individuals deliberately prefer staying nearby for an opportunity to reproduce. Birth chances were retuned and couples observe recovery periods between births, scaled by species maturity. Parents and children retain actual ancestry and relationship records.
- **Species-aware lifespan curves:** Senescent mortality begins later and increases steeply in old age rather than treating everyone beyond a single threshold identically.
- **Transparent causes of death:** Each death is categorized as old age, starvation, harsh-terrain exposure, or declining health. The World Chronicle records yearly causes rather than a generic death message. "Declining health" is not a claim that illnesses or disease are simulated.
- **World History → Population Health:** Shows annual births/deaths, living juveniles, counts and trends by species, births/deaths since tracking started, recorded juvenile deaths, average age at death, and cumulative mortality breakdowns.
- **Legacy save compatibility:** This remains world schema v2. Old v0.2 worlds load unchanged and begin collecting detailed demographic records on their first new annual tick. Older snapshots retain their population counts; the app never fabricates unobserved historical death causes. v0.1 migrations still work.
- **Expanded tests:** Mortality attribution, childhood losses, conservation of births/deaths, deterministic seeds, legacy snapshots, file round-trips, map interventions and long-running seeded ecology tests.

## How to test the balance

1. Launch the app, select **Evolution Lab**, and create a new world using **Four Kingdoms** with normal resources. 
2. Advance time in increments or run for 150–300 simulated years. Open **History** and inspect **Population Health**: births and deaths by species and recorded causes.
3. Compare normal and resource-poor scenarios using the same seed and starting populations. Harsh scarcity should still matter; stable worlds should no longer routinely lose most species immediately.
4. Export world JSON to preserve a timeline. Worlds saved before v0.2.1 show diagnostics only from their first post-update year.

### Limits

This is a transparent, rule-based fantasy ecology, not real demographic science, learned cognition, advanced parenting or illness epidemiology. Population equilibrium is an outcome of needs, regrowth, movement and reproduction—not an artificial guarantee of immortality or guaranteed species survival. The world population remains capped at 850 individuals per simulated world for browser performance. Diagnostics deliberately do not predict the future or retroactively reconstruct unspecified causes. Full households, childcare, psychology and occupations remain on the long-term roadmap.

\`\`\`bash
git pull origin main
npm install
npm run dev
npm test
npm run build
\`\`\`

---

## Previous releases

# CircuitBuilder v0.14.0 — Evolution Lab v0.2: Relationships & Family

**Lab 04 now simulates lasting bonds, interbreeding, heritable ancestry and persistent family history.** Its world is significantly larger and the people are deliberately smaller.

## Try it

1. Update and open **04 EVOLUTION LAB** from the homepage.
2. In **World Creator**, choose a new map size: **Small 96×64, Medium 160×104, Large 256×160, or Vast 320×208**. The old maximum was 82×54. Vast is ~15× as many tiles as the old maximum; large-world simulation may run slower on older machines. Use the **Allow Cross-Species Families** checkbox to control whether mixed-species partnerships can form.
3. Open **WORLD** and advance time. People forage, move, age, and may form a courtship bond with compatible nearby adults. Bonds gain strength with proximity and can mature into partnerships, or weaken and end. Surviving partners can re-pair after separation/death.
4. Partnerships that remain close, healthy and resourced may produce children. Parents both contribute **50% of their ancestry** and a mixture of heritable genes (vigor, curiosity, fertility, sociability), subject to a small mutation. An elf+human child is 50% elf/50% human; a child of that person and a human is 25% elf/75% human. A child has a dominant display species for map coloring and weighted life parameters, not a new fixed "half-elf" hardcoded species.
5. Click a person on the map and choose **VIEW FAMILY TREE**, or open **♡ FAMILIES** directly. Inspect that individual's ancestry bar, historical parents/grandparents, partners/bonds, siblings and children. Clicking a family member navigates to their record; **FIND ON MAP** returns to a living person.
6. Use the zoom controls (up to 8×) to find tiny 2-pixel inhabitants on the much larger map. Settlements remain marked separately.
7. Experiment with placing an adult of one species near another species' settlement, with mixed-species families enabled. Track new bonds and mixed births in **HISTORY**.
8. Export JSON as a portable backup, or allow the browser to autosave. The app **migrates your existing v0.1 saved world** and preserves its original terrain dimensions, populations and timeline; new world creation is required to use the larger map sizes. v0.2 browser autosaves use compact terrain encoding to conserve local storage. Exported JSON remains human-readable.

## Mechanics

- Four peoples: humans (fast generational turnover, frequent wandering), elves (long-lived forest specialists), dwarves (caves/mountains), demons (remote volcanic or wasteland regions). For hybrid children, baseline lifespan, maturity age, fertility, roaming and metabolism are blended from ancestry rather than taken exclusively from the label.
- Adults require suitable maturity, health and energy to enter a bond. Compatibility accounts for inherited ancestry and heritable social/curiosity tendencies. Same-species pairs have a higher typical compatibility, but cross-species pairings are possible. **Close relatives (including siblings and shared grandparents) cannot become partners.**
- Courtships become reciprocal partnerships after repeated nearby interactions. They may dissolve with prolonged separation. Reproduction uses the actual paired adults' identities and requires enough food/health, a compatible free tile, and mature ages. Both parents' unique IDs are stored on the child's lineage record.
- Ancestry records include historical individuals, even deceased relatives, their parental IDs, descendants, and partners. To keep long-running worlds manageable, history retains up to 14,000 lineage entries; older unknown ancestors display as missing rather than being invented.
- The world uses the existing **seeded deterministic simulation**: the same seed, configuration and sequence of interventions reproduce the same outcomes. Parents do not have fixed sexes or gender roles in this initial abstract social model.
- Map rendering now uses **6-pixel biome tiles** and **2-pixel individual centers**, versus 12-pixel tiles and large 7-pixel inhabitants before. Regions are rendered onto a pixel-art Canvas. Full-map fit and zoom help navigate the larger geography.

## Honest boundaries

This is still a **rule-based, stochastic agent simulation**, not a trained neural cellular automaton or conscious beings. "Bond" and "love" represent an abstract compatibility/proximity partnership model, not deep emotional psychology. The species and genetics are fantasy mechanics, not claims about biological populations. Major wars, disaster systems, independent demon realms, and reinforcement learning are future work.

Your earlier Analog Lab, Signal Lab and Computer Builder work is left untouched.

## Development

\`\`\`bash
git pull origin main
npm install
npm run dev
npm test
npm run build
\`\`\`

---

## Previous releases

# CircuitBuilder v0.13.0 — Lab 04 / Evolution Lab v0.1

**Evolution Lab is a real fourth laboratory.** Its initial release is an autonomous, seeded fantasy-world ecosystem where humans, elves, dwarves, and demons can age, forage, roam, reproduce within their species, die, and form or lose settlements. The interface uses handcrafted pixel-art canvas rendering, shared retro-neon typography, and three purpose-built pages: **World**, **World Creator**, and **History**.

## Getting started

1. Select **04 Evolution Lab** from the minimal homepage or top laboratory navigation.
2. Press **▶ PLAY** (or **+1 YEAR / +10**) to advance the simulation. A tick represents **one simulated year**, not one day. Change the speed from 1 to 16 years/second.
3. Open **World Creator** to choose a preset or customize the populations, 44×30 / 64×42 / 82×54 world size, random seed, available resources, and wandering tendency. Confirm **GENERATE THIS WORLD** to begin again.
4. Inspect the world by clicking a tile or individual. See biome and resources, individual age, energy, health, species maturity/lifespan, inherited vigor/curiosity genes, and available parent IDs.
5. Use the **MAP TOOL** selector to spawn any of the four peoples, replenish food or repaint terrain. Reproduction and settlement decisions then respond to the updated environment. Individuals cannot be stacked and water cannot be painted beneath living people.
6. Use the **MAP LAYER** selector to highlight food abundance; zoom into the map or fit it again. A keyboard user can focus the map, navigate with arrow keys, and apply a selected brush with Enter.
7. Open **History** for a per-species population graph (toggle each series), a reverse-chronological event log, active settlements, and cumulative births/deaths.
8. **Export World JSON** to download a portable backup, **Import World JSON** to restore it, or **Replay This Seed** to restart the same experimental conditions. The current world autosaves in this browser even when you move to another lab; a separate world key prevents collision with your circuit and CASM work.

## Species and world rules

| Species | Typical lifespan | Adult from | Yearly fertility tendency | Wander tendency | Preferred biomes |
|---|---:|---:|---:|---:|---|
| Humans | 74 years | 16 | High | High | Plains, forests |
| Elves | 245 years | 36 | Low | Low | Forests |
| Dwarves | 166 years | 27 | Medium-low | Very low | Mountains, caves |
| Demons | 137 years | 23 | Medium-low | Moderate | Wastelands, volcanic corners |

These are **gameplay parameters**, not literal real-world biology. Individuals have randomly varied inheritable vigor, curiosity and fertility modifiers; offspring are born from two nearby same-species mature adults with enough energy and a free compatible tile. They inherit modified gene values from the two parents. There is no partner/love system or interbreeding yet; those belong to v0.2.

Terrain contains renewable food based on biome, and wandering/foraging is weighted by biome preference and nutrient availability. Bad conditions can cause exhaustion and health loss; senescence becomes more likely later in the typical lifespan. Populations are bounded to 850 individuals for this first, browser-friendly version.

Four or more nearby compatible adults in favored terrain can found named settlements. Settlements count nearby residents, accumulate a simplified stores resource and collapse if abandoned for five years. This first release has no actual buildings, war, diplomacy or disasters. The demon realm is **represented only by remote scorched starting biomes**; multi-layer portals are not implemented yet.

## Technical architecture and limitations

- **Pure deterministic engine:** \`src/evolution/engine.ts\` contains world generation, agent updates, reproduction, settlement development, interventions, a seeded pseudo-random number generator, and saved-world validation. The same seed, configuration, and sequence of interventions produce the same result.
- **Pixel-world renderer:** \`src/evolution/WorldCanvas.tsx\` paints biomes, resource overlay, individual sprites, and settlements onto Canvas 2D. CPU/RAM simulation from the electronics labs remains completely isolated.
- **React pages:** \`EvolutionLab.tsx\`, \`WorldCreator.tsx\`, and \`EvolutionHistory.tsx\` provide focused play, creation and analysis experiences. No new dependencies are required.
- **State snapshots:** Autosave uses local browser storage; JSON export/import supports world backups with validation. History retains the latest 400 annual samples and a bounded event log.
- **Future releases:** love/relationships, interbreeding and hybrids, family trees, dynamic culture and settlements, environmental disasters and conflicts, multiple fantasy realms, more sophisticated genetics, individual learning, neural cellular automata, and actual evolutionary neural training.

**Important distinction:** This is **an agent-based simulation on a cellular landscape**, not a trained neural cellular automaton. We should not claim that the agents learn or that war/love/hybrids are currently simulated. v0.1 is designed as a comprehensible and reproducible foundation for those additions.

## Run

\`\`\`bash
git pull origin main
npm install
npm run dev
npm test
npm run build
\`\`\`

---

## Previous releases

# CircuitBuilder v0.12 — Computer Builder: Hardware + Code Studio

Lab 03 is deliberately **split into two full-screen workspaces** rather than squeezing an assembler, debugger, schematic, components, and diagnostics into the same row. The top Lab 03 navigation now has:

**▣ HARDWARE** — a clean circuit canvas with collapsible PARTS and TOOLS; wire 4/8/16-bit buses, edit CPU/ROM circuits, inspect components, step the clock, graph signals, and check the circuit. Both side panels start closed to give the design maximum width. Selecting a chip automatically reveals its inspector. The active project is saved locally; Export Circuit JSON creates a separate backup.

**⌘ CODE STUDIO** — a *separate page within Lab 03*, with a large line-numbered CASM source editor, example program picker, target ROM selector, assembly error list, **draft bytecode vs injected ROM bytecode**, live PC/ACC/OUT/flags debugger, breakpoints, clock stepping, and RAM inspector. On desktop, source/bytecode and debugger appear in separate columns; on narrow screens, they stack.

## Inject CASM into an existing circuit

1. Open Lab 03 → **CODE STUDIO**. Pick a target **16×8 program ROM** by name/ID (the default sample contains one).
2. Write CASM or pick an example. Code edits are a **draft**, saved locally in your browser—not executed and not silently written to ROM. Drafts survive Hardware ↔ Code Studio navigation and browser reloads.
3. The assembler continuously validates syntax and builds a **draft preview**. Click a line-specific error to jump to it. Press **↯ ASSEMBLE & INJECT INTO CIRCUIT**, or **Ctrl/Cmd+Enter**, only when you want to program the selected ROM.
4. Injection updates the **ROM component's source and 16 real 8-bit machine-code bytes** without replacing/rewiring your circuit. CPU/register/RAM runtime resets, and the draft is cleared only after a successful injection.
5. Choose **INJECTED ROM** to inspect what the CPU actually fetches from the hardware. **DRAFT PREVIEW** displays hypothetical bytes that have *not* been injected.
6. Run the real CPU or step instructions and inspect the RAM and flags. Breakpoints stop *before* selected PC addresses. **VIEW TARGET IN HARDWARE** returns to the schematic and focuses the ROM you programmed.
7. Use **⇧ IMPORT .CASM** and **⇩ EXPORT .CASM** to move source files independently of circuit JSON. Import never injects automatically. **RESTORE FROM ROM** discards an un-injected draft (after confirmation).
8. Existing project examples in the **⋮** menu remain available, with confirmation before replacing the working circuit. Un-injected drafts are also explicitly mentioned in this confirmation.

### Quality-of-life details

- No six-tab inspector with CODE squeezed into it. Hardware and Code Studio have independent, focused layouts.
- Hardware defaults to **canvas only** (PARTS and TOOLS are one click away).
- More reliable feedback: a saved-but-not-injected draft is labeled both in Code Studio and on the Hardware view. The simulator always runs ROM bytes, never the un-injected editor buffer.
- Assemble errors are clickable and take you to the specific line; Tab indents four spaces; Ctrl/Cmd+Enter injects.
- Code Studio is readable on larger screens and mobile, with a dedicated debugger and a separate machine-code panel. Code editor keyboard input is not hijacked by circuit canvas shortcuts.
- Drafts are stored **per ROM ID**, so each ROM can have a separate working source. Choosing another ROM never injects or overwrites either of them.
- The currently running computer is the same electrical simulator as before; no alternate hidden CASM execution system was added.
- Old project JSON and previously saved browser circuits remain supported. The Analog and Signal labs are unaffected.

### Scope

CASM remains the original fixed 4-bit CPU instruction set. The CPU4 component's decoder is *not yet* a decomposable, gate-level custom ISA. Draft autosave is on the **local browser only** (not cloud sync); exporting a .casm text file or project JSON remains the portable backup. Exporting project JSON includes **injected ROM source and bytes**, not un-injected browser drafts—use Export .CASM to back up those.

## Development

\`\`\`bash
git pull origin main
npm install
npm run dev
npm test
npm run build
\`\`\`

---

## Earlier releases

# CircuitBuilder v0.11 — CASM: Our First Assembly Language

CircuitBuilder now includes **CASM (Circuit Assembly)**, a real assembler and a wired, programmable four-bit teaching CPU.

**Get started:** Open Lab 03 / Computer Builder. New projects open with the CASM programmable CPU starter; existing saved projects are preserved. To load it manually, choose **Project (⋮) → LOAD PROGRAMMABLE CASM CPU**. Open the **⌘ CODE** tab, edit the source, press **ASSEMBLE & LOAD**, then **STEP INSTRUCTION**.

### Hello CASM

    ; calculate 3 + 5
    START:
        LDI 3
        ADD 5
        OUT
        HLT

This compiles into machine-code bytes **13 25 C0 D0** in hexadecimal. The executed CPU output is **8**.

### Instruction encoding

Every instruction is one 8-bit byte (high nibble = opcode, low nibble = operand/address). The program ROM contains 16 bytes and CPU RAM contains sixteen four-bit words.

| Hex opcode | Instruction | Behavior |
|---|---|---|
| 0 | NOP | No operation |
| 1 | LDI n | Load n into accumulator |
| 2 | ADD n | Add immediate modulo 16 |
| 3 | SUB n | Subtract immediate modulo 16 |
| 4 | AND n | Bitwise AND |
| 5 | OR n | Bitwise OR |
| 6 | XOR n | Bitwise XOR |
| 7 | LOAD a | Read RAM address a |
| 8 | STORE a | Write accumulator to RAM address a |
| 9 | JMP a | Jump to address a |
| A | JZ a | Jump if ZERO is 1 |
| B | JNZ a | Jump if ZERO is 0 |
| C | OUT | Latch accumulator to output port |
| D | HLT | Halt execution |
| E | INC | Increment accumulator |
| F | Reserved | Fault on invalid opcode |

Operands are integers 0–15, optionally written in hexadecimal (0xA) or binary (0b1010). Labels can precede an instruction and may be referenced before or after their declaration. Comments begin with semicolon, hash or two slashes. CASM reports line-specific syntax errors and does not replace a working ROM program when assembly fails.

### Learn by running

The **CODE** panel offers three ready-to-edit examples: addition, a countdown loop, and storing/loading RAM. The bytecode listing highlights the current instruction. Click an address to set a breakpoint. Run at 1–8 instructions per second, pause, step one instruction, reset, or examine the ACC/PC/OUT registers, flags, and all sixteen RAM words.

The debugger shows the eight instruction bits **fetched through the actual electrical bus**. If you disconnect the ROM from the CPU, the CPU faults instead of executing from a hidden JavaScript program. Save a project as JSON to preserve both source text and the ROM bytecode. Undo/redo also applies to code loaded into the ROM.

### CPU implementation and limits

The starter schematic connects a **4-bit PC bus** to a **16×8 instruction ROM**, routes its eight output bits into the clocked CPU4 component, and routes the four output-port bits through a splitter to LEDs. A reset switch, clock generator, HALT/FAULT LEDs, named buses, and live circuit diagnostics are included.

**Honest limitation:** the CPU4 component currently implements a *fixed internal instruction decoder and state registers*. Instruction fetch, ROM contents, buses and external signals are real editable circuit connections, and the simulator responds to them. The decoder is not yet decomposed into user-editable gates and the ISA isn't user-definable. Building an optional gate-level control unit, configurable opcodes, larger register files, and peripherals is next.

The original clocked CPU datapath, Signal Lab, Analog Lab, saved blocks, JSON projects, and multi-bit net engine continue to work.

### Run locally

    git pull origin main
    npm install
    npm run dev
    npm test
    npm run build

---

## Previous releases
# CircuitBuilder v0.10 — Digital Buses, Named Nets, Smart Wiring & Live Diagnostics

This release focuses on **designing bigger digital computers without manually drawing dozens of one-bit connections**. Signal Lab and Computer Builder share a backwards-compatible electrical model and editor controls. Analog Lab is unchanged.

## 1. Connect a real 4 / 8 / 16-bit bus

- In Signal Lab or Computer Builder, place any component with numbered bit ports (for example, a ROM's \`Q[3:0]\`, a register's \`D[3:0]\`, or a 4-bit ALU's \`A[3:0]\`).
- **Right-click the source chip**, then choose **START 4-BIT Q[3:0]** (or the appropriate grouped port).
- Click a destination chip with a matching group to connect automatically. If it has multiple groups, **right-click the destination** and choose the precise one (for example, \`B[3:0]\` instead of \`A[3:0]\`).
- The **thick, colored bus** is an electrical connection made from separate bit-level nets, not a short between all the wires. Bit 0 connects to bit 0, and so on.
- Select the bus to give it a name such as \`DATA\`. **Two buses with the same name and width** join bit-for-bit within the same schematic, even if the bus strokes are far apart.
- Delete a bus, undo/redo its creation, or edit its routing with the same tools as scalar wires. Esc cancels an incomplete bus operation.

New passive **4-bit, 8-bit, and 16-bit splitters** appear under Data Routing. Each splitter maps \`BUS0 ↔ BIT0\`, \`BUS1 ↔ BIT1\`, and so on. Wire a specific BIT pin as a normal one-bit wire to drive an LED, selector or control pin. You can combine ordinary one-bit wires with grouped connections freely.

**Note:** A grouped bus connects existing numbered ports; arbitrary-width 32/64-bit scalable chip models are still a future feature. This release supports 4, 8 and 16-bit bus groups and 1-bit taps. Bus width mismatches are blocked rather than silently truncated.

## 2. Name nets instead of drawing long signal lines

- Select any one-bit wire. In the Inspector's **NAMED SIGNAL** field, enter a name such as \`CLK\`, \`RESET\` or \`READY\` and press Enter or click away.
- Every one-bit wire bearing **the same exact name** now shares an electrical node **inside that schematic**. This also works through custom blocks when editing their internal circuit; names do *not* leak into unrelated block instances.
- Clear the field to disconnect the implicit link. Names are case-sensitive, 1–24 characters, beginning with a letter or underscore, followed by letters/digits/underscores.
- A scalar signal named \`DATA\` will **not** short all bits of a bus named \`DATA\` together. Use a splitter to select a bit instead.

When copying components with named wires or buses, the copies intentionally **lose their names** to avoid unintended connections back to the originals.

## 3. Smarter wire routes and movable corners

- One-bit wires and buses now prefer **orthogonal routes that avoid other chip bodies**, with horizontal/vertical alternatives and detours.
- Right-click a wire or bus to **FLIP CORNER**, **MOVE BEND HERE**, or restore **SMART AUTO ROUTE**.
- After placing a manual bend, select its connection and **drag the glowing square handle** to reposition the bend on the grid.
- These changes work with undo/redo and are exported in the JSON schematic.

## 4. Circuit Check — diagnostics with locations

In either digital lab, open **⚠ CHECK** to see problems updated as you edit:
- Conflicting outputs driving the same net (error)
- Unconnected inputs and undriven clock pins (warning/error)
- Multiple widths sharing one named bus (error)
- A one-bit wire and bus sharing a name (warning; they remain separate)
- Combinational feedback loops without a sequential element (warning)

Click **LOCATE IN CIRCUIT** to select and center the affected chip, wire, or bus; small warning markers appear on affected chips. You can filter errors or warnings. The existing four-state logic and waveform analyzer still run separately.

## Compatibility and limits

The file structure retains **Signal Lab version 1** with optional \`buses\` and wire/bus \`label\` fields. Older files lacking those fields continue working. Captured reusable block definitions retain internal buses and names; each module instance is still electrically isolated unless connected through explicit external ports.

The static diagnostics apply to the **currently open schematic** (open a block to inspect its internals). They are not a formal proof that a circuit is functionally correct; for correctness, use truth tables, typed input tests, clock stepping and waveforms.

## Run locally

\`\`\`bash
git pull origin main
npm install
npm run dev
npm test
npm run build
\`\`\`

---

## Earlier releases

# CircuitBuilder v0.9 — Clean Home + Three Purpose-Built Labs

The landing page is deliberately minimal: a small, labeled CPU circuit diagram and
**exactly three buttons**—**01 Analog Lab**, **02 Signal Lab**, and **03 Computer Builder**.
No oversized dashboard, summary cards, counters, or extra action panels. The original
pixel-arcade aesthetic remains, with a more restrained navy, violet and mint palette.

## What changed in v0.9

### Lab 03 — Computer Builder (new workbench)

**Computer Builder is a real third laboratory**, not a link back to Signal Lab.
It reuses the tested digital simulation engine and circuit-editor tools, but has
a purpose-built CPU interface:

- Starts with an **editable, simulated 4-bit CPU datapath**, not a blank board.
- Focused controls: Parts, Undo/Redo, **Step Clock**, simulation tools, and project actions.
- An uncluttered, three-step onboarding strip: **Pick a part → Connect pins → Step the clock**.
- Right-side **RUN / EDIT / GRAPH / INPUT** tools. Clicking a component
  automatically opens its inspector; click ROM to edit program words.
- **Clock stepping, +8/+16 cycles, auto run, reset, logic waveforms**, and live stored-state readouts.
- Part search and favorites; state/memory and computing-unit categories open first
  in Computer Builder rather than burying them below every Boolean gate.
- Open example designs: CPU datapath, four-bit counter and D flip-flop.
- Project menu for creating a new circuit, importing valid Signal Lab JSON and
  exporting the full editable schematic. Local changes autosave in the browser.
- Existing custom blocks still open on double-click and support Save / Cancel edits.

The current CPU example is a **clocked four-bit datapath**. It does not implement a
full instruction decoder or execute machine code. No new ISA or assembler is claimed.

### Separate saved projects

Signal Lab and Computer Builder now have **independent locally persisted workspaces**.
Switching between them preserves the circuit layout and ROM programs in each. Analog
Lab retains its own original workspace as before.

For safety, the editor asks you to finish a block's draft before switching labs.
Runtime register/RAM state is reset when changing workspaces; saved ROM contents,
component/wire definitions and user-designed blocks remain intact. New users start
Computer Builder with the CPU sample. Prior Signal Lab JSON data remains compatible.

### Easier navigation and larger schematics

- A single home screen with **only three lab choices**. The top navigation is
  reduced to the application logo while you're on Home.
- Use the global navigation when working in a lab to switch laboratories or
  click the brand to return to Home.
- Digital editors now **fit all components and wires into view on initial load**,
  including tall multi-pin chips and the wide CPU sample.
- The canvas toolbar's **⊡ FIT** button returns to an overview after panning or zooming.
- Computer Builder opens selected components directly in **EDIT** for immediate
  renaming, rotating, ROM programming, and deletion.
- On narrow/mobile screens, the circuit canvas appears **before** the component
  catalog, keeping the main task accessible without excessive scrolling.
- Export means an actual downloaded \`.signal.json\` file. Browser autosave is
  local to this device; it is **not** cloud synchronization.

## Development

\`\`\`bash
git pull origin main
npm install
npm run dev
npm test
npm run build
\`\`\`

---

## Earlier releases

# CircuitBuilder v0.8 — Computer Foundations & CPU Home Screen

CircuitBuilder is becoming a hardware design workbench. Alongside Analog Lab's DC/RLC electrical solver, Signal Lab can now simulate **combinational AND sequential digital circuits**, including small RAM, programmable ROM, registers, counters, and a 4-bit arithmetic/logic unit. The app opens to a new **retro neon home screen featuring a live CPU datapath**.

## What you can build today

The v0.8 foundation can build an actual *small clocked digital computer datapath* using these new parts:

| New part | Pins and behavior |
| --- | --- |
| CLOCK SOURCE | OUT; emits one logical 0→1→0 pulse on every CLOCK STEP |
| D FLIP-FLOP | D, CLK → Q; captures D on a **rising** clock edge |
| T FLIP-FLOP | T, CLK → Q; toggles when T=1 on a rising edge |
| 4-BIT REGISTER | D0–D3, CLK, EN → Q0–Q3; stores one 4-bit word when EN=1 |
| 4-BIT COUNTER | CLK, EN, RESET → Q0–Q3; synchronous 4-bit increment and reset |
| 16×4 RAM | A0–A3, D0–D3, WE, CLK → Q0–Q3; 16 words of 4 bits, synchronous write and asynchronous read |
| 16×4 ROM | A0–A3 → Q0–Q3; editable program table persisted in the circuit JSON |
| 4-BIT ALU | A0–A3, B0–B3, OP0, OP1 → Y0–Y3, CARRY, ZERO; ADD / AND / OR / XOR |

The bit numbering convention is **bit 0 = least-significant bit (LSB)**. Clocked parts update together based on the previous state, so a chain of registers won't accidentally propagate several cycles in one edge. The CPU datapath uses that exact behavior.

### How to try the CPU demo

1. Open the **Home** page. The CPU chip illustration is **live**: use **CLOCK STEP**, **+8 CYCLES**, or **RESET** to watch the program counter and accumulator evolve.
2. Click **OPEN THE 4-BIT CPU DEMO** to load its actual wired schematic in Signal Lab. This starter connects a CLOCK to a PC counter and accumulator; PC → ROM → ALU → ACC with ACC feedback to ALU and output LEDs.
3. Open the **▣ CPU** tab in Signal Lab to step once, run 8/16 cycles, autoplay at 1/2/4/8 Hz, or reset the simulation state.
4. Select the ROM and edit its **16 hexadecimal words** in the Inspector, then save the program. ROM bytes (nibbles) are stored in the JSON schematic, while runtime register and RAM values reset when restarting simulation or editing circuit topology.
5. Probe any pin or wire using right-click and open **WAVEFORM** to inspect the changes after each tick. The existing binary input tester also supports manual rising-edge triggers when an INPUT switch is wired to CLK.
6. Try the **D Flip-Flop** and **Clocked 4-Bit Counter** samples. For arithmetic, connect four ALU output bits to LEDs and wire its OP0/OP1 lines to choose a logical operation.

### Simulation model

- CLOCK STEP creates one **discrete logical event**, not a calibrated nanosecond time delay.
- On a rising clock edge, all stateful components sample *pre-edge* values simultaneously. RAM writes only if WE=1 at the edge; RAM reads are asynchronous.
- Clocked state is separate from schematic geometry. Simulation resets clear registers/counters/RAM, while ROM definitions are part of the saved circuit.
- Every 4-bit data channel uses **four separate named pins and wires**. Bundled multi-bit buses are a future UI/data-model feature.
- Four-state signal semantics are preserved: 0, 1, X (unknown), Z (undriven). The digital engine reports floating pins and output-driver conflicts.
- Truth tables remain available for **combinational** designs. Sequential circuits use clock stepping and waveform analysis, not a misleading static truth table.

### What would still be required for a more advanced computer?

You can build educational 4-bit CPU *datapaths* now, but **not yet a complete programmable general-purpose CPU**. The provided CPU example repeatedly adds ROM data to an accumulator; it does not decode or execute machine instructions. To expand toward an 8/16/32-bit computer, planned milestones include:

1. **Instruction decoder / control unit, program branching, flags and jump conditions**.
2. **Register files, RAM/ROM scaling, integrated multi-bit buses and signal grouping**.
3. **Assembler or machine-code program loader, ISA definition and debugger**.
4. **Large-design performance, stronger sequential/timing tests, validation tools, memory addressing and peripherals**.
5. **Configurable propagation delays and richer clock scheduling**, if physical timing becomes a goal.

A modern multicore computer also needs sophisticated pipelines, caches, interrupts, external IO and an optimized simulation backend. v0.8 makes the fundamentals possible without implying those features already exist.

## Development

\`\`\`bash
git pull origin main
npm install
npm run dev
npm test
npm run build
\`\`\`

Your original Analog Lab, Signal Lab Boolean gates, searchable catalog, clockless custom modules, JSON files, and block drilldown remain supported.

---

## Previous release notes

# CircuitBuilder v0.7 — Arcade Parts Catalog & Advanced Digital Components

Signal Lab's neon pixel-art parts library now contains **20 built-in components**, searchable and organized into categories with favorites and recently used shortcuts. The digital engine supports three-input logic, fixed logic levels, data routing, and two-output arithmetic devices. Analog Lab and saved reusable blocks remain supported.

## Search and organize digital components

- Expand **PARTS** and use the search box, or press **/** to focus the search when the catalog is visible. Search by part name, circuit concept, or alias: \`mux\`, \`carry\`, \`3-input\`, \`inverter\`, \`ground\`, \`majority\`.
- Browse categorized sections: **Inputs & Sources**, **Basic Logic Gates**, **Multi-Input Gates**, **Data Routing**, **Binary Arithmetic**, and **Output & Display**.
- Choose a category filter to narrow the catalog. Fold any section to get more canvas space.
- Star a component using **☆** to pin it under Favorites. Recently placed components appear in a second quick-access strip. Favorite and recent kinds persist locally across browser reloads.
- Saved user-designed circuit blocks remain under **Your Reusable Blocks**, searchable by block name.
- Right-click an empty grid cell for an organized list of components to place at the clicked position. Click or drag built-in parts directly from the catalog.

## 10 new simulated components

| Part | Pins | Digital behavior |
| --- | --- | --- |
| Logic HIGH | OUT | Constant digital \`1\`; not a user-toggleable input |
| Logic LOW | OUT | Constant digital \`0\`; not a user-toggleable input |
| 3-input AND | A, B, C → OUT | HIGH when all three inputs are HIGH |
| 3-input OR | A, B, C → OUT | HIGH when any input is HIGH |
| 3-input XOR | A, B, C → OUT | Odd parity across three input bits |
| Majority | A, B, C → OUT | HIGH when two or more inputs are HIGH |
| MUX 2:1 | A, B, SEL → OUT | Select A when SEL=0, B when SEL=1 |
| DEMUX 1:2 | IN, SEL → OUT0, OUT1 | Route IN to one output; unused output LOW |
| Half Adder | A, B → SUM, CARRY | SUM = A xor B; CARRY = A and B |
| Full Adder | A, B, CIN → SUM, CARRY | SUM = A xor B xor CIN; CARRY = majority(A,B,CIN) |

**Full adder example:** three inputs \`A=1,B=1,CIN=0\` produce \`SUM=0,CARRY=1\`. Connect independent LEDs to SUM and CARRY, or capture the full circuit as a reusable module and combine modules for larger arithmetic circuits.

The Boolean engine retains four-state semantics: HIGH (1), LOW (0), unknown/conflict (X), undriven (Z). Known controlling values produce deterministic results, even alongside unknowns where mathematically justified (for example \`AND3(0,X,Z)=0\` and \`MAJORITY(1,1,Z)=1\`). These are combinational components, not clocked or propagation-delay models.



### Analog Lab search and organization

Analog Lab now shares the neon search-and-category experience. Its existing eight
simulated parts are grouped under **Passives & Reference**, **Sources & Controls**,
and **Energy Storage**, with collapsible categories, quick category filters,
and keyword searching (for example \`coil\`, \`current\`, or \`variable resistor\`).
No analog component model or solver behavior has been changed.

## Improvements under the hood

- A single part-definition catalog drives search, category navigation, and right-click placement.
- New multi-pin, multi-output component geometry is shared between the canvas and electrical connectivity checks.
- The hierarchical compiler and Boolean solver now handle any number of named inputs and outputs on a primitive; reusable blocks can contain the new devices.
- Full-adder and demultiplexer outputs are independent signal nets rather than a combined fake output.
- Automated tests cover Boolean truth tables, four-state propagation, pin geometry and wiring, hierarchy compatibility, and catalog search/favorites.

## Update & run

\`\`\`bash
git pull origin main
npm install
npm run dev
npm test
npm run build
\`\`\`

---

## Previous releases

# CircuitBuilder v0.6.1 — Block Wiring & Circuit Drilldown

This release fixes Signal Lab's reusable-block pin connections and adds a direct way to edit the original circuit inside any saved module.

## Connect a reusable block

- **Block input pins** are named \`in0\`, \`in1\`, etc.; outputs are \`out0\`, \`out1\`, etc. The editor now uses the component's actual declared pins during wiring, so these are accepted just like AND/OR/XOR gate pins.
- Click an INPUT or gate output pin, then a block input, to wire a block. Click a block output and another gate or LED input to connect its result.
- Free-ended wires and intentional junctions remain supported. A component input placed directly onto a drawn trace is still recognized as connected.
- Named pin labels (for example \`A\`, \`B\`, \`SUM\`, \`CARRY\`) remain visible on the block body.

## Open and edit a block

1. **Double-click** any placed block on the Signal Lab canvas. Or select it and choose **OPEN & EDIT BLOCK** in the inspector, or right-click the block and choose **OPEN & EDIT INTERNAL CIRCUIT**.
2. The canvas switches to the block's *original, expanded* schematic. A breadcrumb bar shows **ROOT CIRCUIT › BLOCK NAME**, including nested levels.
3. Change internal gates, move parts, reroute traces, or rename interface INPUT switches and LED outputs. Undo/redo remains available inside the draft.
4. Choose **SAVE BLOCK** to validate and publish the edited schematic. Every instance referencing that same saved block now uses the new logic. The parent schematic returns automatically.
5. Choose **CANCEL / BACK** to discard the current level's uncommitted edits and return to the parent without altering it.

Saving edits to a nested module updates the shared definition of that nested module. External pin identities remain stable, so an edit cannot silently disconnect pre-existing wires. For this first editor, keep the original boundary INPUT and LED components; add or remove internal gates freely. If you need a different number of boundary pins, capture a new block with the desired interface.

While editing internals, the app persists the last committed parent schematic, **not the temporary draft**. Save the block before refreshing. Existing v1 Signal Lab and Analog Lab documents remain compatible.

## Verify locally

\`\`\`bash
git pull origin main
npm install
npm run dev
npm test
npm run build
\`\`\`

---

## Previous release notes

# CircuitBuilder v0.6 — Signal Lab Modules + Waveform Tools

CircuitBuilder has two separate neon pixel-art workbenches: Analog Lab and Signal Lab. This release expands **Signal Lab** with *reusable circuit blocks*, a four-channel logic-event waveform graph, and a typed input-vector tester.

## Condense a circuit into a block
1. Create a combinational digital circuit with one or more **INPUT switches**, at least one gate (or existing block), and one or more **LED outputs**.
2. Open **Signal Lab → Parts Library → Reusable Circuit Blocks → Capture Current Circuit**.
3. Give the module a descriptive name and click **Save as Block**.
4. INPUT switches automatically become external module **IN** pins and LED indicators become **OUT** pins. The full circuit is stored as an immutable module definition.
5. The current workspace is replaced with the condensed block and wired input/output controls. **Undo** brings back the original uncondensed design.
6. Find the block under **Reusable Circuit Blocks**. Drag or click to insert another instance into an existing or newly created circuit. Each instance has isolated internal gate state and independently connected pins.

Saved modules persist in their own browser library. Exported Signal Lab schematics embed their referenced module definitions and dependencies, so imported circuits remain portable. Larger blocks can contain instances of smaller blocks; self-referential definitions are rejected.

Blocks support up to 12 external inputs and 12 outputs. Module definitions are snapshots: changing the source circuit afterward does not retroactively alter already saved modules. Regenerate a new module to publish an updated design.

## Signal waveform probing
- Right-click any **wire** and choose **Graph This Wire**, or right-click a component and choose **Probe** beside a named pin.
- Alternatively, choose up to **four** pins/wires in the **WAVEFORM** panel.
- Switch inputs to record a waveform, or enter a series of vectors in INPUT TEST. The chart plots the resulting 0/1/X/Z states against **input-change event number**.
- Click the graph or enter an exact **Event #** to inspect the states recorded at that event, then use previous/next buttons.
- The buffer stores the last 160 changes and can be reset.

**Important:** A combinational simulator evaluates logic without real nanosecond timing or physical gate propagation delays. Therefore this chart is an **event history**, not an oscilloscope with real propagation-time measurements. Clock sources, propagation delays and sequential logic are future upgrades.

## Type binary inputs and read outputs
Open **INPUT TEST** in Signal Lab:
- Enter a binary vector matching the number of INPUT switches (e.g. \`01\` for two inputs).
- Click **Apply & Evaluate** to set every switch simultaneously and immediately read the LED output vector.
- Enter a comma-separated sequence such as \`00, 01, 11, 10\` to step through several input combinations; the waveform panel records each event. Up to 32 vectors per submitted sequence.
- Input order and output order are shown explicitly, using the circuit's component order.

The digital engine supports four states: HIGH 1, LOW 0, undefined/conflict X, and undriven Z. Truth tables and embedded blocks use the same pure Boolean evaluation engine.

## Development
\`\`\`bash
npm install
npm run dev
npm test
npm run build
\`\`\`

This release retains the existing **Analog Lab** with its separate Modified Nodal Analysis and transient engine. It also preserves compatibility with previous Signal Lab documents lacking reusable blocks.

---

## Previous release notes

# CircuitBuilder v0.5 · Analog Lab + Signal Lab

Two neon pixel-art electronics laboratories, one React/TypeScript application.

## Switch labs
Use the laboratory navigator across the top of the app:
- **01 Analog Lab:** existing analog DC and RLC simulation workbench. The underlying Modified Nodal Analysis engine and saved analog schematics remain intact.
- **02 Signal Lab:** a standalone Boolean logic engine, its own editor, local autosave, and dedicated .signal.json document schema.

### Signal Lab v0.1 — what's included
- **Eight gates:** AND, OR, NOT, XOR, NAND, NOR, XNOR, BUFFER.
- **Inputs:** click an INPUT switch to change between 0 and 1.
- **Outputs:** LED indicators glow for HIGH, dim for LOW, pink for undefined.
- **Digital netlist and logic engine:** electrically connected terminals drive signal nets; switching inputs instantly recomputes results. There is no analog solver dependency.
- **Four-state simulation:** HIGH (1), LOW (0), unknown/conflict (X), and undriven (Z). Multiple output drivers on a net are flagged as conflicts. Floating gate inputs are reported.
- **Automatic truth tables:** enumerate every combination of up to six input switches, including all LED outputs (up to 64 rows).
- **Retro editor:** glowing signal traces, pixel-drawn gates, snap/pan/zoom, free-ended wires and junctions, right-click editing, multi-select, copy/paste, undo/redo.
- **Examples:** XOR Playground, AND Gate Lab, NOT Gate Lab and a two-output half adder.

### Quick start in Signal Lab
1. Click **SIGNAL LAB** in the top lab switcher.
2. Drop two INPUT components, one gate, and an LED.
3. Click terminal pins to connect. You may leave a wire dangling in empty space and attach it later.
4. Click the INPUT switches to toggle their bits. Observe live wire colors and LED state.
5. Open **TRUTH TABLE** and click **GENERATE TRUTH TABLE** to evaluate all input permutations.
6. Export via **FILE → EXPORT .SIGNAL.JSON**, import later through the same menu.

Signal files include \`"lab": "signal"\` and \`"version": 1\`, preventing accidental loading into Analog Lab. Each lab maintains its own browser autosave; switching labs does not delete the other lab's work.

### Visual semantics
- HIGH/1: luminous mint green, with animated propagation markers.
- LOW/0: dim blue.
- X: bright pink for invalid or undefined results.
- Z: gray for undriven signals.

Signal animations are decorative representations of logical HIGH propagation, not a physical delay or current model. Pure trace crossings do not connect; free-end junctions and terminal contacts do.

### Scope
Signal Lab currently handles **combinational logic**. Clocks, flip-flops, buses, counters, propagation delay and waveform timing are future milestones; feedback that fails to stabilize returns X. This engine is separate from Analog Lab's DC/transient solver.

## Development
Requires Node.js 20+ (22 recommended).

\`\`\`bash
npm install
npm run dev
npm test
npm run build
\`\`\`

GitHub Actions validates both laboratories on each pull request.

---

## Previous Analog Lab release notes

# CircuitBuilder v0.4 — Arcade Editor Polish

**Latest:** animated conventional-current particles on electrically unbranched wires, voltage-based neon coloring, deliberately marked junctions, undo/redo, group editing, quick SI-unit input, and hideable panels. The physics is still computed by the existing DC / transient MNA solvers.

## A calmer workbench

- Top toolbar consolidates **Undo**, **Redo**, **Copy**, **Paste**, **DC**, **RLC**, and toggles for the **Parts** and **Panel** sidebars.
- The right sidebar now has **INSPECT / SIMULATE** tabs; shortcuts are tucked under an expandable reference.
- Circuit presets remain in **Parts Library → Instant Labs** (collapsed by default).
- The schematic hides voltage text on unrelated components until selected, while highlighting the selected component's A-terminal net or the selected wire's entire electrical net.
- `◉ FLOW` on the lower right of the canvas toggles the animation. The preference persists, and operating systems requesting reduced motion disable the effect.

## Editing shortcuts

| Action | Shortcut or gesture |
| --- | --- |
| Undo / redo | Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z (Ctrl+Y also redoes) |
| Multi-select | Shift-click several components |
| Move selection | Drag any selected component to move them together |
| Select all | Ctrl/Cmd+A |
| Copy / paste | Ctrl/Cmd+C / Ctrl/Cmd+V |
| Duplicate | Ctrl/Cmd+D |
| Rotate | R |
| Delete selected parts / wire | Delete / Backspace |
| Move a free wire end | Shift-drag its glowing endpoint |
| Straighten a wire | Right-click wire → STRAIGHTEN ROUTE |
| Edit values | Type `4.7k`, `100uF`, `10mH`, `5mA`, etc., then Enter or leave the field |

Copy/paste recreates internal wires for selected components using new component and wire IDs. A drag creates one undo-history entry instead of hundreds of entries for each mouse movement. History is limited to the last 80 editing actions; it is not persisted between browser reloads. Existing circuit JSON files remain schema version 1.

## Electrical honesty of the animation

Animated dots represent **conventional current** (positive charge-flow direction), derived from signed simulated branch currents. They are intentionally shown only when a wire belongs to an electrically unbranched net with two terminals and a single wire. On branching and ideal-wire networks, segment current distribution may not be uniquely determined by the ideal circuit model, so those traces remain illuminated according to their **simulated node voltage** without misleading directional particles. Particle speed is illustrative, not a physical drift velocity or calibrated current meter. Use the inspector and time panel for quantitative readings.

## Transient resolution

The Time Machine exposes **60, 120, 240, and 500 sample steps** across the chosen time window. Higher steps improve time resolution at increased computational cost. The solver still assumes constant DC excitation from t=0 with initially uncharged capacitors and zero inductor currents (Backward Euler, fixed-step).

---
## Troubleshooting electrical connections (v0.3 repair)

Component terminals placed directly on a drawn wire now electrically connect to the trace. Previously, the graph could show an attached pin but omit it from the solver, leading to a misleading singular-matrix error. Pure wire crossings without endpoints still do not join.

If DC analysis reports a floating node, its message names affected component pins (for example R2.A). Check those contacts. Capacitors and open switches do not conduct in steady-state DC even when correctly wired; use transient analysis for charging behavior.

If an ideal voltage source is shorted by a wire, you receive a direct short diagnosis. Parallel ideal sources and loops of ideal shorts can also make the equations singular.

---
# CircuitBuilder v0.3 — Neon Time Lab

**New in v0.3:** Free-ended traces, right-click menus, real capacitors and inductors, and a time-position scrubber over an RLC transient simulation.

## Free wiring and junctions

- Click any glowing terminal to begin a wire.
- **Click blank grid** to leave a free endpoint; the free tip glows pink. Continue the path with more clicks, or press **ESC** to leave it dangling.
- To add a part later, drag and position one of its terminals exactly over the free tip. The contact is electrically recognized when a pin matches the free wire endpoint. The editor uses a **24 px visual grid with 12 px snapping** so every kind of pin (including ground) can meet a dangling tip.
- A free endpoint laid on an existing wire forms a junction (no component required). You can also **right-click a wire → START BRANCH HERE**.
- Right-click empty canvas to **START FREE WIRE HERE** or place one of eight components.
- **Right-click a component** to edit its numeric value, rotate, toggle a switch, start a wire from a particular pin, adjust a potentiometer wiper, or delete it.
- **Right-click a wire** to branch or delete it. The inspector remains available for detailed readings.
- Mid-wire crossings without explicit wire endpoints or component pads do **not** connect. Older terminal-to-terminal wiring behavior is retained.

## Transient RLC analysis

Two new energy-storage components join the existing six basic analog parts:

| Component | Default value | Unit |
| --- | --- | --- |
| Capacitor (C) | 100 µF | Farads (100 µF = 0.0001 F) |
| Inductor (L) | 100 mH | Henrys (100 mH = 0.1 H) |

Select the **RC CHARGING** or **RL RESPONSE** lab in the left palette, then click **RUN TRANSIENT** in the **TIME MACHINE** panel. You can:

1. Choose a time window in **milliseconds**.
2. Drag the time slider to any simulated time step, or use **PLAY / PAUSE**.
3. See the voltages/currents update on your canvas and inspector at the selected time.
4. Select another part and switch between **V** and **I** graphs to inspect its waveform.

Transient analysis uses **Backward Euler** companion models and Modified Nodal Analysis. It simulates a **constant independent DC source step starting at t = 0**, with **initial capacitor voltages of 0 V and initial inductor currents of 0 A**. The default timeline uses 240 equal time steps. This is a linear lumped-circuit simulator, not a full SPICE transient system: no nonlinear diodes, varying waveforms, switches changing state mid-run, arbitrary user-set initial conditions, or adaptive step size yet.

Steady-state **DC** still works: a capacitor is an open circuit and an inductor is an ideal short. v0.1 and v0.2 exported documents remain readable because the document schema version stays at 1.

---

## Background: v0.2 Neon Arcade

A neon pixel-arcade **analog circuit workbench** powered by real circuit equations. Place components, wire their glowing terminal pins, run DC analysis, and explore how voltage and current flow.

The interface is intentionally playful; the circuit math is not faked.

## Quick start

Requires Node.js 20+ (Node 22 recommended).

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (typically http://localhost:5173/).

```bash
npm run build
npm test
```

## Features

- Neon-retro CRT aesthetic, luminous wire paths, pixel-art component sprites, scanline finish and animated activity indicators.
- Canvas editor with 24 px grid snapping, pan, zoom, drag, rotate, select and wire removal.
- **Six** basic linear DC components:
  - Resistor (R), in ohms
  - Independent ideal voltage source (V), in volts
  - Ground (GND)
  - **SPST switch (S)** — open / closed
  - **Independent ideal current source (I)** — amps, signed A → B
  - **Three-terminal potentiometer (P)** — total ohms and adjustable A/W/B wiper
- Inspect component properties, branch current, voltage, and power.
- Run real Modified Nodal Analysis (MNA) with pivoted Gaussian elimination.
- Save automatically in your browser and export/import v1-compatible JSON.
- Four instant labs: voltage divider, switch control, current source, potentiometer.

## Controls

| Action | How |
| --- | --- |
| Add a part | Drag from Parts Library or click a palette item |
| Connect wires | Click the glowing terminal on one part, then on another |
| Pan | Drag empty canvas |
| Zoom | Mouse wheel or +/- bottom-right |
| Rotate | Select component then press **R** or click Rotate in inspector |
| Flip an SPST switch | Double-click switch sprite, select + press **Space**, or use inspector |
| Adjust potentiometer | Select pot, then move wiper slider between 1% and 99% |
| Remove a part or wire | Select it then press **Delete** / **Backspace** |
| Cancel wiring | **Esc** |
| Save in browser | Autosave, SAVE button, or **Ctrl/Cmd + S** |
| Export | EXPORT downloads a JSON schematic |
| Import | IMPORT opens compatible JSON |
| Try a new component | Select one of the **Instant Labs** presets |

## Circuit model and conventions

- All **ground** symbols refer to the same zero-voltage node.
- Resistors are stamped as conductances, \(1/R\).
- A **closed SPST** is an ideal 0-volt constrained branch (its current is calculated); an **open SPST** has zero current.
- An independent **current source** forces current *from* pin **A** *to* pin **B** (current injection is negative at A and positive at B).
- A **potentiometer** is modeled as two resistors A–W and W–B. A wiper setting of 25% yields A–W = 0.25 × total resistance and W–B = 0.75 × total resistance.
- A resistor's current and an ideal source's current are signed **A → B**. Potentiometer current shown in the inspector is the A → W segment current (wiper load can make A → W and W → B currents different).
- Power is signed \(P = V I\) using the passive sign convention. Negative source power means delivering power.
- Potentiometer power reports the **sum of dissipated power** in its two internal segments.
- Solver detects singular configurations such as floating nodes, shorts on ideal voltage sources, and conflicting ideal-source loops.
- Resistive values range from 0.001 Ω to 1 GΩ. Wiper range 0.1–99.9% internally, adjusted through a 1–99% UI slider.

### File format

Schematics use a versioned JSON object: `{ version: 1, name, components, wires }`.
New v0.2 kinds are additive to the v0.1 schema; existing exported schematics and locally saved documents remain compatible.

```json
{
  "version": 1,
  "name": "A little switch",
  "components": [
    { "id": "s1", "kind": "switch", "x": 240, "y": 240, "rotation": 0, "value": 0, "closed": true }
  ],
  "wires": []
}
```

Switches have two pins A/B. Potentiometers have three pins A/B/W. Resistors, independent sources, and switches use A/B. Ground uses G.

## Tech stack

- React 19 + TypeScript
- Vite
- HTML Canvas 2D for sharp, precise vector/pixel-art schematics
- Zustand for application state and browser persistence
- Vitest for solver regressions and component behavior
- GitHub Actions for build + test verification on pushes / pull requests

### Code layout

```text
src/
  circuit/
    types.ts             Serialized model, pins and geometry
    connectivity.ts      Terminal-level union-find connectivity graph
    sample.ts            Four playable circuit labs
  simulation/
    dc.ts                Standalone MNA engine and Gaussian solver
    dc.test.ts           Existing voltage-divider/validation regressions
    newComponents.test.ts Switch, current-source and potentiometer tests
  state/
    useCircuitStore.ts   Editor actions, simulation state and browser saves
  components/
    CircuitCanvas.tsx    Schematics, sprites, glowing wires, pan/zoom
    Inspector.tsx        Numeric inputs, switch toggle, pot slider, results
    Palette.tsx          Component library and instant lab presets
  App.tsx
  styles.css             Base layout
  neon.css               Neon arcade theme and CRT finish
```

## Scope of v0.2

This is a **linear DC** simulator, not full SPICE. No time-domain transients, capacitors, inductors, diode nonlinearities, frequency response, probes, mid-wire junction editing, or cloud accounts yet. If opening a switch leaves a fully floating circuit, MNA will report a clear singular-network error rather than invent node voltages. All wire connections are currently terminal-to-terminal.

Future ideas: transient RLC simulation, LED/diodes, SPDT switches, oscilloscopes, shared schematics, undo/redo, better signal instruments.

> Educational portfolio project only. Verify electrical calculations independently before building real hardware.
