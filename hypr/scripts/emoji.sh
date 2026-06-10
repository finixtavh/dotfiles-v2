#!/bin/bash
# ── Emoji Picker ──
# Usa rofi para seleccionar un emoji y copiarlo al clipboard

EMOJI_FILE="$HOME/.config/hypr/scripts/emojis.txt"

# Generar archivo de emojis si no existe
if [[ ! -f "$EMOJI_FILE" ]]; then
    cat > "$EMOJI_FILE" << 'EMOJIS'
😀 Grinning Face
😁 Beaming Face
😂 Face with Tears of Joy
🤣 Rolling on the Floor
😃 Smiling Face with Open Mouth
😄 Grinning Face with Smiling Eyes
😅 Grinning Face with Sweat
😆 Squinting Face
😉 Winking Face
😊 Smiling Face with Smiling Eyes
😋 Face Savoring Food
😎 Smiling Face with Sunglasses
😍 Heart Eyes
😘 Face Blowing a Kiss
🥰 Smiling Face with Hearts
😗 Kissing Face
😙 Kissing Face with Smiling Eyes
✏️ Pencil
✒️ Nib
🖋️ Pen
🖊️ Marker
🖌️ Paintbrush
🖍️ Crayon
🥲 Smiling Face with Tear
😚 Kissing Face with Closed Eyes
😜 Winking Face with Tongue
😝 Squinting Face with Tongue
😛 Face with Tongue
🤑 Money-Mouth Face
🤗 Hugging Face
🤭 Face with Hand Over Mouth
🫢 Face with Open Eyes
🫣 Face with Peeking Eye
🤫 Shushing Face
🤔 Thinking Face
🫡 Saluting Face
🤐 Zipper-Mouth Face
🤨 Face with Raised Eyebrow
😐 Neutral Face
😑 Expressionless Face
😶 Face Without Mouth
🫥 Dotted Line Face
😏 Smirking Face
😒 Unamused Face
🙄 Face with Rolling Eyes
😬 Grimacing Face
😮‍💨 Exhaling Face
🤥 Lying Face
😌 Relieved Face
😔 Pensive Face
😪 Sleepy Face
🤤 Drooling Face
😴 Sleeping Face
😷 Face with Medical Mask
🤒 Face with Thermometer
🤕 Face with Head-Bandage
🤢 Nauseated Face
🤮 Vomiting Face
🤧 Sneezing Face
🥵 Hot Face
🥶 Cold Face
🥴 Woozy Face
😵 Face with Crossed-Out Eyes
🤯 Exploding Head
🤠 Cowboy Hat Face
🥳 Partying Face
🥸 Disguised Face
😎 Cool
🤓 Nerd Face
🧐 Monocle
😕 Confused Face
🫤 Face with Diagonal Mouth
😟 Worried Face
🙁 Slightly Frowning
☹️ Frowning Face
😮 Face with Open Mouth
😯 Hushed Face
😲 Astonished Face
😳 Flushed Face
🥺 Pleading Face
🥹 Holding Back Tears
😦 Frowning Face with Open Mouth
😧 Anguished Face
😨 Fearful Face
😰 Anxious Face with Sweat
😥 Sad but Relieved
90: 😢 Crying Face
😭 Loudly Crying
😱 Screaming
😖 Confounded Face
😣 Persevering Face
😞 Disappointed Face
😓 Downcast with Sweat
😩 Weary Face
😫 Tired Face
🥱 Yawning Face
😤 Face with Steam
😡 Pouting Face
😠 Angry Face
🤬 Cursing
😈 Smiling Face with Horns
👿 Angry Face with Horns
💀 Skull
☠️ Skull and Crossbones
💩 Pile of Poo
🤡 Clown Face
👹 Ogre
👺 Goblin
👻 Ghost
👽 Alien
👾 Alien Monster
🤖 Robot
❤️ Red Heart
🧡 Orange Heart
💛 Yellow Heart
💚 Green Heart
💙 Blue Heart
💜 Purple Heart
🖤 Black Heart
🤍 White Heart
💔 Broken Heart
❤️‍🔥 Heart on Fire
💯 Hundred Points
💢 Anger Symbol
💥 Collision
💫 Dizzy
💦 Sweat Droplets
🔥 Fire
⭐ Star
🌟 Glowing Star
✨ Sparkles
⚡ High Voltage
🎉 Party Popper
🎊 Confetti Ball
👍 Thumbs Up
👎 Thumbs Down
👊 Oncoming Fist
✊ Raised Fist
🤛 Left-Facing Fist
🤜 Right-Facing Fist
👏 Clapping Hands
🙌 Raising Hands
🫶 Heart Hands
👐 Open Hands
🤲 Palms Up Together
🤝 Handshake
🙏 Folded Hands
✌️ Victory Hand
🤞 Crossed Fingers
🫰 Hand with Index Finger
🤟 Love-You Gesture
🤘 Sign of the Horns
🤙 Call Me Hand
👈 Pointing Left
👉 Pointing Right
👆 Pointing Up
👇 Pointing Down
☝️ Index Pointing Up
✋ Raised Hand
🤚 Raised Back of Hand
🖐️ Hand with Fingers Splayed
 vulcan Vulcan Salute
👋 Waving Hand
🤏 Pinching Hand
✍️ Writing Hand
💪 Flexed Biceps
🦾 Mechanical Arm
🖕 Middle Finger
EMOJIS
fi

selected=$(cat "$EMOJI_FILE" | rofi -dmenu -i -p "😀 Emoji" -theme-str 'window { width: 500px; } listview { lines: 12; }')

if [[ -n "$selected" ]]; then
    emoji=$(echo "$selected" | cut -d' ' -f1)
    echo -n "$emoji" | wl-copy
    notify-send "😀 Emoji" "Copiado: $emoji" -a "Emoji Picker" -t 2000
fi
