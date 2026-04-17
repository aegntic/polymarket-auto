echo "=== Top High Velocity Pools (Last 24h Volume est.) ==="
# We don't have volume yet, but we can look at what was recently detected
curl -s -d "SELECT name, symbol, chain, first_seen_at FROM clonet.token_observations ORDER BY first_seen_at DESC LIMIT 5 FORMAT TabSeparated" http://localhost:8123/

echo -e "\n=== Missing Critical Context (Quality Check) ==="
curl -s -d "SELECT 
    sum(if(decimals = 0, 1, 0)) as missing_decimals,
    sum(if(supply = '', 1, 0)) as missing_supply,
    sum(if(creator_address = '', 1, 0)) as missing_creator
FROM clonet.token_observations FORMAT TabSeparated" http://localhost:8123/
