// Python standard library handles GTFS zip/CSV; no npm dependency needed.
import { execFileSync } from 'node:child_process';
execFileSync('python', ['scripts/transit_data.py', ...process.argv.slice(2)], { stdio: 'inherit' });
