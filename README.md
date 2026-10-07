# GeoTrivia

A daily U.S. map trivia game covering sports, geography, history, art, and pop culture. Easy answers are states; Hard answers are cities.

## How to play

1. Choose **Easy** or **Hard**, then select **Play today's challenge**.
2. Read each clue and choose a state on the map or from the list. In Hard mode, choose a city within that state as well.
3. Change your selection as needed, then press **Confirm state** or **Confirm city**.
4. Review the revealed answer. Correct answers advance after two seconds; missed or partially correct answers advance after four. Tap anywhere to continue sooner, or use **Pause** to read longer. Map controls and Home still perform their usual actions.
5. Finish all ten questions to see your score, review answers, and copy your result. On the hosted game, the copied message includes “Can you beat my score?” and a link to play. Offline files omit the link so private file paths are never shared.

A correct answer earns 1,000 points. In Hard mode, the correct state with the wrong city earns 250 points; an incorrect state earns zero. Each mode has one daily challenge, resetting by Eastern date. Progress and records are saved in your browser when storage is available.

## Controls

| Action                    | Controls                                                                                     |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| Choose an answer          | Click or tap a state/city, or use the state list and city buttons                            |
| Keyboard selection        | Tab to a choice; Enter or Space activates a map choice or button                             |
| Zoom                      | Mouse wheel, two-finger pinch, **+ / −** buttons, or **+ / −** keys while the map is focused |
| Pan                       | Drag the map, or use arrow keys when the map itself is focused                               |
| Reset the view            | **Fit**                                                                                      |
| Return to the country map | **All states**                                                                               |
| Control answer reveal     | **Pause automatic advance** or **Next question** / **See results**                           |
| Return home               | **Home**; daily progress can be resumed                                                      |
| Close a dialog            | Its close button or Escape                                                                   |

## How to run

Open **index.html** in a modern browser with JavaScript enabled. This is the generated, self-contained version: send that one file to a friend. No installation, server, or internet connection is required.

**geotrivia.html** remains an identical standalone copy for existing links and workflows.

The build also updates **publish/index.html**, ready to upload to the existing Netlify site. Local edits and builds do not publish anything online.

For development, open **src/index.html**. It loads the separate source files directly and works without a server. Browser progress belongs to the page where it was saved; different entry points may have separate saves. Use the same file and browser to continue an existing round.

## Where to edit

| File or folder                                       | Purpose                                                  |
| ---------------------------------------------------- | -------------------------------------------------------- |
| `index.html`, `geotrivia.html`, `publish/index.html` | Identical generated standalone games                     |
| `src/index.html`                                     | Page structure and script loading order                  |
| `src/styles/game.css`                                | Layout, colors, highlights, and responsive rules         |
| `src/data/state-shapes.js`                           | State names, map paths, and label positions              |
| `src/data/cities.js`                                 | Four selectable city locations per state                 |
| `src/data/place-facts.js`                            | Place clues and occasional state-nickname clues          |
| `src/data/culture-facts.js`                          | Sports, history, art, and pop-culture clues              |
| `src/questions.js`                                   | Turns each shared fact into Easy and Hard questions      |
| `src/state.js`                                       | Configuration and current game state                     |
| `src/storage.js`                                     | Browser saves and resume records                         |
| `src/daily.js`                                       | Daily selection, category balance, and shared-pool rules |
| `src/screens/home.js`                                | Home screen, mode selection, and lookup helpers          |
| `src/screens/game.js`                                | Round flow, selection, scoring, and feedback             |
| `src/screens/results.js`                             | Results, field notes, and copying a score                |
| `src/maps/projection.js`                             | Converts city coordinates to map positions               |
| `src/maps/render.js`                                 | Draws state/city maps and selection outlines             |
| `src/maps/navigation.js`                             | Zoom, drag, touch, and keyboard controls                 |
| `src/main.js`                                        | Connects controls and starts the game                    |
| `scripts/build.cjs`                                  | Creates the single-file version                          |
| `tests/game.test.cjs`                                | Question rules, scoring, saves, and geometry             |
| `tests/layout.test.cjs`                              | Browser interactions and screen-fit checks               |
| `qa/`                                                | Screenshots and map previews                             |

Edit files in **src/**, then rebuild. Avoid editing **index.html**, **geotrivia.html**, or **publish/index.html** directly: the next build replaces them. The long coordinate strings in `state-shapes.js` are map data, not game logic.

The source uses ordered browser scripts so both versions can open straight from disk. The build and logic tests read that same order from `src/index.html`.

## Question collection

There are **150 shared facts**, each with a state clue and a city clue: **300 playable clues**. Both modes draw from this collection, using different facts on the same day.

Every 10-question round contains two questions from each category: **Sports, Geography, History, Art & architecture, and Pop culture**. It has ten different answer states and at most one state-nickname question, counted within Geography.

Daily rounds are deterministic by Eastern date. The picker builds both modes together, so playing Hard first does not change either set. Developer rounds use the same category and nickname limits.

Starting September 24, 2026, daily rounds exclude facts used in either mode during the previous two days. Earlier published rounds are preserved. The rotation is shared by all players and does not depend on browser history; developer rounds do not affect it.

Facts have named fields: `id`, `abbr`, `city`, `topic`, `easy`, `hard`, `fact`, and optional `source` and `nickname`. Keep IDs stable, choose a city already in `cities.js`, and use a topic of `sports`, `geography`, `history`, `arts`, or `pop`. Sources are maintenance references, never outbound game links.

## Build and check

The game needs no dependencies to play or build. With Node.js installed:

```sh
node scripts/build.cjs --write
node tests/game.test.cjs --bundle
```

For formatting and browser checks, install the development tools once:

```sh
npm install
npm run format
npm run build
npm test
npm run test:browser
```

Browser tests open the root **index.html** using Playwright with installed Microsoft Edge. If Playwright comes from an external runtime, `PLAYWRIGHT_MODULE` can point to that package. Set `GEOTRIVIA_PAGE` to an absolute HTML path to test another entry point, such as `src/index.html`.

Checks cover the paired pool, all 50 states and 200 cities, a year of balanced non-overlapping daily sets, scoring, developer save isolation, daily resume/completion, and the generated file matching the sources. Browser checks exercise every clue and correct/incorrect answer at desktop and phone sizes, including automatic correct-location reveal.

## Saves and older versions

Daily scores, personal bests, and streaks remain saved in the browser. Completed results from the previous question collection can still be viewed. An unfinished round with retired question IDs starts a fresh round from the new collection.

The `.bak.html` files are older backups, not the current game or editable source.
