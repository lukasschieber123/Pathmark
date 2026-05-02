
set proj to "/Users/lukasschieber/Repos/travel-globe"
do shell script "python3 -m http.server 8765 --directory " & quoted form of proj & " > /dev/null 2>&1 &"
delay 0.8
do shell script "open -na 'Google Chrome' --args --app=http://localhost:8765/"
