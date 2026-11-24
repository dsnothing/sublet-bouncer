import { execFileSync } from 'node:child_process';
execFileSync('python', ['scripts/transit_data.py', '--geocode'], { stdio: 'inherit' });
