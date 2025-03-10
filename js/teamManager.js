export class TeamManager {
    constructor() {
        this.teams = {
            'Real Madrid': {
                name: 'Real Madrid',
                homeColor: 0xFFFFFF, // White
                awayColor: 0x1A237E, // Dark Blue
                goalKeeperColor: 0x004D40, // Teal
                logo: 'real_madrid.png',
                shortName: 'RMA'
            },
            'Liverpool': {
                name: 'Liverpool',
                homeColor: 0xD50000, // Red
                awayColor: 0x212121, // Black
                goalKeeperColor: 0xFFD600, // Yellow
                logo: 'liverpool.png',
                shortName: 'LIV'
            },
            'Bayern Munchen': {
                name: 'Bayern Munchen',
                homeColor: 0xC62828, // Red
                awayColor: 0x000080, // Navy Blue
                goalKeeperColor: 0x388E3C, // Green
                logo: 'bayern.png',
                shortName: 'BAY'
            },
            'Barcelona': {
                name: 'Barcelona',
                homeColor: 0x00429D, // Blue
                awayColor: 0xFFB612, // Yellow
                goalKeeperColor: 0x000000, // Black
                logo: 'barcelona.png',
                shortName: 'BAR'
            },
            'Manchester City': {
                name: 'Manchester City',
                homeColor: 0x6CABDD, // Light Blue
                awayColor: 0x263238, // Dark Gray
                goalKeeperColor: 0xC2185B, // Pink
                logo: 'man_city.png',
                shortName: 'MCI'
            },
            'Manchester United': {
                name: 'Manchester United',
                homeColor: 0xDA291C, // Red
                awayColor: 0xFFFFFF, // White
                goalKeeperColor: 0x388E3C, // Green
                logo: 'man_utd.png',
                shortName: 'MUN'
            }
        };
        
        // Default teams
        this.playerTeam = 'Real Madrid';
        this.aiTeam = 'Barcelona';
    }
    
    getTeamData(teamName) {
        return this.teams[teamName] || this.teams['Real Madrid']; // Default to Real Madrid if team not found
    }
    
    setPlayerTeam(teamName) {
        if (this.teams[teamName]) {
            this.playerTeam = teamName;
            return true;
        }
        return false;
    }
    
    setAITeam(teamName) {
        if (this.teams[teamName]) {
            this.aiTeam = teamName;
            return true;
        }
        return false;
    }
    
    getPlayerTeamData() {
        return this.getTeamData(this.playerTeam);
    }
    
    getAITeamData() {
        return this.getTeamData(this.aiTeam);
    }
    
    getAvailableTeams() {
        return Object.keys(this.teams);
    }
} 