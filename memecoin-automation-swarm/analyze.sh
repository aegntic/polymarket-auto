echo "=== Chain Breakdown ==="
curl -s -d "SELECT chain, COUNT(*) as count FROM clonet.token_observations GROUP BY chain ORDER BY count DESC FORMAT TabSeparated" http://localhost:8123/

echo -e "\n=== Top 10 Symbols (Clone Targets) ==="
curl -s -d "SELECT symbol, COUNT(*) as count FROM clonet.token_observations GROUP BY symbol ORDER BY count DESC LIMIT 10 FORMAT TabSeparated" http://localhost:8123/

echo -e "\n=== Token Age Span ==="
curl -s -d "SELECT min(first_seen_at) as oldest, max(first_seen_at) as newest FROM clonet.token_observations WHERE first_seen_at != '' FORMAT TabSeparated" http://localhost:8123/

echo -e "\n=== Exact Name Collisions (Multi-chain or Clones) ==="
curl -s -d "SELECT name, COUNT(DISTINCT token_address) as unique_addresses, groupArray(chain) as chains FROM clonet.token_observations GROUP BY name HAVING unique_addresses > 1 ORDER BY unique_addresses DESC LIMIT 5 FORMAT TabSeparated" http://localhost:8123/
