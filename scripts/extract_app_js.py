#!/usr/bin/env python3
"""Extrait le JS inline de index.html sur stdout, pour `node --check`.

Usage : python3 scripts/extract_app_js.py > app.js && node --check app.js
"""
import pathlib
import re
import sys

html = (pathlib.Path(__file__).resolve().parent.parent / "index.html").read_text(encoding="utf-8")
sys.stdout.write("\n".join(re.findall(r"<script>(.*?)</script>", html, re.S)))
