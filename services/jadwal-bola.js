const axios = require('axios');

async function scrapeJadwalBola(date = null, timezone = 'Asia/Jakarta') {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const defaultDate = `${year}${month}${day}`;
    const matchDate = date || defaultDate;

    const url = `https://www.fotmob.com/api/data/matches?date=${matchDate}&timezone=${encodeURIComponent(timezone)}&ccode3=IDN&includeNextDayLateNight=true`;
    const headers = {
        "x-mas": "eyJib2R5Ijp7InVybCI6Ii9hcGkvZGF0YS9tYXRjaGVzP2RhdGU9MjAyNjA2MjkmdGltZXpvbmU9QXNpYSUyRkpha2FydGEmY2NvZGUzPUlETiZpbmNsdWRlTmV4dERheUxhdGVOaWdodD10cnVlIiwiY29kZSI6MTc4MjcyNDI5NzIzNiwiZm9vIjoicHJvZHVjdGlvbjozYmU0MjM0ZTE3YzRlZGQzNTYwYmNiZjgzOWFlNmE3NjU5NGIzMzg0In0sInNpZ25hdHVyZSI6IjY1OTU2Nzc0OTEzMDIwRUE0REU1N0UzMEUxRUU3NzJEIn0=",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
    };

    const response = await axios.get(url, { headers, timeout: 15000 });
    const data = response.data;
    const leagues = data.leagues || [];

    return {
        date: matchDate,
        timezone,
        totalLeagues: leagues.length,
        leagues: leagues.map(league => ({
            league: league.name,
            matches: (league.matches || []).map(match => ({
                home: match.home?.name || 'Unknown',
                away: match.away?.name || 'Unknown',
                score: match.status?.scoreStr || 'vs',
                status: match.status?.description || 'Scheduled'
            }))
        }))
    };
}

module.exports = { scrapeJadwalBola };
