export type Track = {
  id: string;
  title: string;
  duration: number; // in seconds
};

export type Album = {
  id: string;
  title: string;
  artist: string;
  year: string;
  sleeveStyle: string;
  labelStyle: string;
  tracks: Track[];
};

export const albums: Album[] = [
  {
    id: "kind-of-blue",
    title: "Kind of Blue",
    artist: "Miles Davis",
    year: "1959",
    sleeveStyle: "linear-gradient(135deg, #0d2b45 0%, #1a4266 100%)",
    labelStyle: "radial-gradient(circle, #cc3333 0%, #990000 100%)",
    tracks: [
      { id: "kob-1", title: "So What", duration: 544 },
      { id: "kob-2", title: "Freddie Freeloader", duration: 586 },
      { id: "kob-3", title: "Blue in Green", duration: 337 },
    ]
  },
  {
    id: "abbey-road",
    title: "Abbey Road",
    artist: "The Beatles",
    year: "1969",
    sleeveStyle: "linear-gradient(135deg, #dce2d6 0%, #90a890 100%)",
    labelStyle: "radial-gradient(circle, #a8d5ba 0%, #688a70 100%)",
    tracks: [
      { id: "ar-1", title: "Come Together", duration: 259 },
      { id: "ar-2", title: "Something", duration: 182 },
      { id: "ar-3", title: "Here Comes the Sun", duration: 185 },
    ]
  },
  {
    id: "dark-side",
    title: "Dark Side of the Moon",
    artist: "Pink Floyd",
    year: "1973",
    sleeveStyle: "linear-gradient(135deg, #050505 0%, #151515 100%)",
    labelStyle: "radial-gradient(circle, #050505 0%, #1a1a1a 100%)",
    tracks: [
      { id: "ds-1", title: "Speak to Me", duration: 65 },
      { id: "ds-2", title: "Breathe", duration: 169 },
      { id: "ds-3", title: "Time", duration: 413 },
    ]
  },
  {
    id: "rumours",
    title: "Rumours",
    artist: "Fleetwood Mac",
    year: "1977",
    sleeveStyle: "linear-gradient(135deg, #d0c5b5 0%, #9a8a75 100%)",
    labelStyle: "radial-gradient(circle, #e6d8c3 0%, #c4b59d 100%)",
    tracks: [
      { id: "rm-1", title: "Second Hand News", duration: 163 },
      { id: "rm-2", title: "Dreams", duration: 254 },
      { id: "rm-3", title: "Never Going Back Again", duration: 122 },
    ]
  },
  {
    id: "blue",
    title: "Blue",
    artist: "Joni Mitchell",
    year: "1971",
    sleeveStyle: "linear-gradient(135deg, #1d3557 0%, #325886 100%)",
    labelStyle: "radial-gradient(circle, #2b4c7e 0%, #152845 100%)",
    tracks: [
      { id: "bl-1", title: "All I Want", duration: 212 },
      { id: "bl-2", title: "My Old Man", duration: 213 },
      { id: "bl-3", title: "Little Green", duration: 205 },
    ]
  },
  {
    id: "innervisions",
    title: "Innervisions",
    artist: "Stevie Wonder",
    year: "1973",
    sleeveStyle: "linear-gradient(135deg, #c7802b 0%, #875113 100%)",
    labelStyle: "radial-gradient(circle, #d49544 0%, #a66e25 100%)",
    tracks: [
      { id: "iv-1", title: "Too High", duration: 276 },
      { id: "iv-2", title: "Vision", duration: 322 },
      { id: "iv-3", title: "Living for the City", duration: 442 },
    ]
  }
];
