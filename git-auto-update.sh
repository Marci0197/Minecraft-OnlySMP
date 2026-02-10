#!/bin/bash
cd ~/Minecraft-OnlySMP || exit

# Alle Änderungen automatisch hinzufügen
git add .

# Commit mit Zeitstempel
git commit -m "Auto-Update $(date '+%Y-%m-%d %H:%M:%S')" 2>/dev/null

# Rebase mit Remote (aktuelle Änderungen einfügen)
git pull --rebase origin main

# Push zum Remote
git push origin main
