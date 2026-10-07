// Shared game configuration and current session state.
const $ = (id) => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const DATA_VERSION = 'shared-trivia-2';
const SAVE_KEY = 'geotrivia.v3';
const DEFAULT_VIEW = { x: -25, y: -15, w: 1035, h: 665 };
const TOPICS = {
  sports: 'Sports',
  geography: 'Geography',
  history: 'History',
  arts: 'Art & architecture',
  pop: 'Pop culture',
};
const state = {
  mode: 'easy',
  kind: 'daily',
  qs: [],
  cq: 0,
  score: 0,
  hist: [],
  selectedState: null,
  selectedCity: null,
  mapState: null,
  answered: false,
  date: null,
  finished: false,
  newBest: false,
};
let settings = { developer: false };
let save = {
  dailies: {},
  active: {},
  streak: 0,
  bestStreak: 0,
  lastDate: null,
  bestScores: { easy: 0, hard: 0 },
  games: 0,
};
let view = { ...DEFAULT_VIEW };
let fitView = { ...DEFAULT_VIEW };
let gesture = null,
  suppressClick = false;
let hoveredState = null,
  focusedState = null;
const pointers = new Map();
