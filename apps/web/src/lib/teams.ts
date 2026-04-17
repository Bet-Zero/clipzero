export type TeamOption = {
  teamId: number;
  tricode: string;
  city: string;
  name: string;
  fullName: string;
};

export const NBA_TEAMS: TeamOption[] = [
  {
    teamId: 1610612737,
    tricode: "ATL",
    city: "Atlanta",
    name: "Hawks",
    fullName: "Atlanta Hawks",
  },
  {
    teamId: 1610612738,
    tricode: "BOS",
    city: "Boston",
    name: "Celtics",
    fullName: "Boston Celtics",
  },
  {
    teamId: 1610612751,
    tricode: "BKN",
    city: "Brooklyn",
    name: "Nets",
    fullName: "Brooklyn Nets",
  },
  {
    teamId: 1610612766,
    tricode: "CHA",
    city: "Charlotte",
    name: "Hornets",
    fullName: "Charlotte Hornets",
  },
  {
    teamId: 1610612741,
    tricode: "CHI",
    city: "Chicago",
    name: "Bulls",
    fullName: "Chicago Bulls",
  },
  {
    teamId: 1610612739,
    tricode: "CLE",
    city: "Cleveland",
    name: "Cavaliers",
    fullName: "Cleveland Cavaliers",
  },
  {
    teamId: 1610612742,
    tricode: "DAL",
    city: "Dallas",
    name: "Mavericks",
    fullName: "Dallas Mavericks",
  },
  {
    teamId: 1610612743,
    tricode: "DEN",
    city: "Denver",
    name: "Nuggets",
    fullName: "Denver Nuggets",
  },
  {
    teamId: 1610612765,
    tricode: "DET",
    city: "Detroit",
    name: "Pistons",
    fullName: "Detroit Pistons",
  },
  {
    teamId: 1610612744,
    tricode: "GSW",
    city: "Golden State",
    name: "Warriors",
    fullName: "Golden State Warriors",
  },
  {
    teamId: 1610612745,
    tricode: "HOU",
    city: "Houston",
    name: "Rockets",
    fullName: "Houston Rockets",
  },
  {
    teamId: 1610612754,
    tricode: "IND",
    city: "Indiana",
    name: "Pacers",
    fullName: "Indiana Pacers",
  },
  {
    teamId: 1610612746,
    tricode: "LAC",
    city: "LA",
    name: "Clippers",
    fullName: "LA Clippers",
  },
  {
    teamId: 1610612747,
    tricode: "LAL",
    city: "Los Angeles",
    name: "Lakers",
    fullName: "Los Angeles Lakers",
  },
  {
    teamId: 1610612763,
    tricode: "MEM",
    city: "Memphis",
    name: "Grizzlies",
    fullName: "Memphis Grizzlies",
  },
  {
    teamId: 1610612748,
    tricode: "MIA",
    city: "Miami",
    name: "Heat",
    fullName: "Miami Heat",
  },
  {
    teamId: 1610612749,
    tricode: "MIL",
    city: "Milwaukee",
    name: "Bucks",
    fullName: "Milwaukee Bucks",
  },
  {
    teamId: 1610612750,
    tricode: "MIN",
    city: "Minnesota",
    name: "Timberwolves",
    fullName: "Minnesota Timberwolves",
  },
  {
    teamId: 1610612740,
    tricode: "NOP",
    city: "New Orleans",
    name: "Pelicans",
    fullName: "New Orleans Pelicans",
  },
  {
    teamId: 1610612752,
    tricode: "NYK",
    city: "New York",
    name: "Knicks",
    fullName: "New York Knicks",
  },
  {
    teamId: 1610612760,
    tricode: "OKC",
    city: "Oklahoma City",
    name: "Thunder",
    fullName: "Oklahoma City Thunder",
  },
  {
    teamId: 1610612753,
    tricode: "ORL",
    city: "Orlando",
    name: "Magic",
    fullName: "Orlando Magic",
  },
  {
    teamId: 1610612755,
    tricode: "PHI",
    city: "Philadelphia",
    name: "76ers",
    fullName: "Philadelphia 76ers",
  },
  {
    teamId: 1610612756,
    tricode: "PHX",
    city: "Phoenix",
    name: "Suns",
    fullName: "Phoenix Suns",
  },
  {
    teamId: 1610612757,
    tricode: "POR",
    city: "Portland",
    name: "Trail Blazers",
    fullName: "Portland Trail Blazers",
  },
  {
    teamId: 1610612758,
    tricode: "SAC",
    city: "Sacramento",
    name: "Kings",
    fullName: "Sacramento Kings",
  },
  {
    teamId: 1610612759,
    tricode: "SAS",
    city: "San Antonio",
    name: "Spurs",
    fullName: "San Antonio Spurs",
  },
  {
    teamId: 1610612761,
    tricode: "TOR",
    city: "Toronto",
    name: "Raptors",
    fullName: "Toronto Raptors",
  },
  {
    teamId: 1610612762,
    tricode: "UTA",
    city: "Utah",
    name: "Jazz",
    fullName: "Utah Jazz",
  },
  {
    teamId: 1610612764,
    tricode: "WAS",
    city: "Washington",
    name: "Wizards",
    fullName: "Washington Wizards",
  },
];

export function isKnownTeam(tricode: string): boolean {
  const normalized = tricode.trim().toUpperCase();
  return NBA_TEAMS.some((team) => team.tricode === normalized);
}
