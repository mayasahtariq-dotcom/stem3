"""Run the scheduler from the command line.  python scripts/run_scheduler.py [--once]"""
import sys
import time

from app.config import get_settings
from app.jobs.runner import run_once

if "--once" in sys.argv:
    print(run_once())
else:
    while True:
        print(run_once())
        time.sleep(get_settings().scheduler_interval)
