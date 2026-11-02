---
README.md
---

# TextProv plugin for Claude Code

A prototype Claude Code plugin that records attribution observations in the shared
[TextProv](https://github.com/textprov/textprov) chronicle while you work, and gives you
`/textprov` to inspect them, match passages between them, and record explicit
attribution claims.

It is a hooks module (a "󠄁m󠄁o󠄁d󠄁"󠄁)󠄁.󠄁 T󠄁h󠄁e󠄁 d󠄁e󠄁f󠄁a󠄁u󠄁l󠄁t󠄁 `prose` m󠄁o󠄁d󠄁e󠄁 m󠄁a󠄁r󠄁k󠄁s󠄁 f󠄁i󠄁l󠄁e󠄁/󠄁d󠄁o󠄁c󠄁u󠄁m󠄁e󠄁n󠄁t󠄁
p󠄁r󠄁o󠄁s󠄁e󠄁 o󠄁n󠄁l󠄁y󠄁.󠄁 U󠄁s󠄁e󠄁r󠄁 p󠄁r󠄁o󠄁m󠄁p󠄁t󠄁s󠄁,󠄁 a󠄁s󠄁s󠄁i󠄁s󠄁t󠄁a󠄁n󠄁t󠄁 p󠄁r󠄁o󠄁g󠄁r󠄁e󠄁s󠄁s󠄁 u󠄁p󠄁d󠄁a󠄁t󠄁e󠄁s󠄁 a󠄁n󠄁d󠄁 s󠄁t󠄁o󠄁r󠄁e󠄁d󠄁 c󠄁h󠄁a󠄁t󠄁 m󠄁e󠄁s󠄁s󠄁a󠄁g󠄁e󠄁s󠄁
s󠄁t󠄁a󠄁y󠄁 a󠄁s󠄁 s󠄁u󠄁p󠄁p󠄁l󠄁i󠄁e󠄁d󠄁.󠄁 `all` a󠄁l󠄁s󠄁o󠄁 m󠄁a󠄁r󠄁k󠄁s󠄁 c󠄁h󠄁a󠄁t󠄁 w󠄁i󠄁t󠄁h󠄁 t󠄁h󠄁e󠄁 s󠄁h󠄁a󠄁r󠄁e󠄁d󠄁 s󠄁p󠄁e󠄁a󠄁k󠄁e󠄁r󠄁 p󠄁o󠄁l󠄁i󠄁c󠄁y󠄁:󠄁 h󠄁u󠄁m󠄁a󠄁n󠄁
f󠄁o󠄁r󠄁 u󠄁s󠄁e󠄁r󠄁 t󠄁e󠄁x󠄁t󠄁 a󠄁n󠄁d󠄁 A󠄁I󠄁 f󠄁o󠄁r󠄁 a󠄁s󠄁s󠄁i󠄁s󠄁t󠄁a󠄁n󠄁t󠄁 t󠄁e󠄁x󠄁t󠄁.󠄁 M󠄁a󠄁c󠄁h󠄁i󠄁n󠄁e󠄁 n󠄁o󠄁t󠄁i󠄁f󠄁i󠄁c󠄁a󠄁t󠄁i󠄁o󠄁n󠄁s󠄁 a󠄁n󠄁d󠄁 t󠄁o󠄁o󠄁l󠄁 r󠄁e󠄁s󠄁u󠄁l󠄁t󠄁s󠄁
a󠄁r󠄁e󠄁 n󠄁e󠄁v󠄁e󠄁r󠄁 c󠄁l󠄁a󠄁s󠄁s󠄁i󠄁f󠄁i󠄁e󠄁d󠄁 a󠄁s󠄁 h󠄁u󠄁m󠄁a󠄁n󠄁 m󠄁e󠄁s󠄁s󠄁a󠄁g󠄁e󠄁s󠄁.󠄁

F󠄁o󠄁r󠄁 `Write` a󠄁n󠄁d󠄁 `Edit` o󠄁n󠄁 `.md`,󠄁 `.markdown`,󠄁 `.txt`,󠄁 `.rst`,󠄁 `.adoc` a󠄁n󠄁d󠄁 `.mdx`,󠄁
n󠄁e󠄁w󠄁 o󠄁r󠄁 r󠄁e󠄁p󠄁l󠄁a󠄁c󠄁e󠄁d󠄁 p󠄁r󠄁o󠄁s󠄁e󠄁 i󠄁s󠄁 m󠄁a󠄁r󠄁k󠄁e󠄁d󠄁 A󠄁I󠄁 w󠄁h󠄁i󠄁l󠄁e󠄁 u󠄁n󠄁c󠄁h󠄁a󠄁n󠄁g󠄁e󠄁d󠄁 t󠄁e󠄁x󠄁t󠄁 k󠄁e󠄁e󠄁p󠄁s󠄁 i󠄁t󠄁s󠄁 e󠄁x󠄁i󠄁s󠄁t󠄁i󠄁n󠄁g󠄁 m󠄁a󠄁r󠄁k󠄁s󠄁.󠄁
M󠄁a󠄁r󠄁k󠄁d󠄁o󠄁w󠄁n󠄁 p󠄁r󠄁o󠄁t󠄁e󠄁c󠄁t󠄁e󠄁d󠄁 s󠄁y󠄁n󠄁t󠄁a󠄁x󠄁 a󠄁n󠄁d󠄁 c󠄁o󠄁d󠄁e󠄁 r󠄁e󠄁m󠄁a󠄁i󠄁n󠄁 u󠄁n󠄁t󠄁o󠄁u󠄁c󠄁h󠄁e󠄁d󠄁.󠄁 E󠄁x󠄁i󠄁s󠄁t󠄁i󠄁n󠄁g󠄁 m󠄁a󠄁r󠄁k󠄁s󠄁 c󠄁o󠄁p󠄁i󠄁e󠄁d󠄁 i󠄁n󠄁t󠄁o󠄁
r󠄁e󠄁p󠄁l󠄁a󠄁c󠄁e󠄁m󠄁e󠄁n󠄁t󠄁 t󠄁e󠄁x󠄁t󠄁 s󠄁u󠄁r󠄁v󠄁i󠄁v󠄁e󠄁.󠄁 E󠄁d󠄁i󠄁t󠄁s󠄁 u󠄁s󠄁e󠄁 t󠄁h󠄁e󠄁 w󠄁h󠄁o󠄁l󠄁e󠄁 d󠄁o󠄁c󠄁u󠄁m󠄁e󠄁n󠄁t󠄁 c󠄁o󠄁n󠄁t󠄁e󠄁x󠄁t󠄁 a󠄁n󠄁d󠄁 m󠄁a󠄁r󠄁k󠄁e󠄁r󠄁-󠄁a󠄁w󠄁a󠄁r󠄁e󠄁
a󠄁n󠄁c󠄁h󠄁o󠄁r󠄁s󠄁;󠄁 a󠄁m󠄁b󠄁i󠄁g󠄁u󠄁o󠄁u󠄁s󠄁 a󠄁n󠄁c󠄁h󠄁o󠄁r󠄁s󠄁 a󠄁r󠄁e󠄁 r󠄁e󠄁f󠄁u󠄁s󠄁e󠄁d󠄁.󠄁 W󠄁r󠄁i󠄁t󠄁e󠄁s󠄁 r󠄁e󠄁a󠄁d󠄁 t󠄁h󠄁e󠄁 p󠄁r󠄁e󠄁v󠄁i󠄁o󠄁u󠄁s󠄁 f󠄁i󠄁l󠄁e󠄁 b󠄁e󠄁f󠄁o󠄁r󠄁e󠄁 m󠄁a󠄁r󠄁k󠄁i󠄁n󠄁g󠄁.󠄁
C󠄁o󠄁d󠄁e󠄁/󠄁c󠄁o󠄁n󠄁f󠄁i󠄁g󠄁 f󠄁i󠄁l󠄁e󠄁s󠄁 a󠄁n󠄁d󠄁 o󠄁t󠄁h󠄁e󠄁r󠄁 t󠄁o󠄁o󠄁l󠄁s󠄁 (󠄁i󠄁n󠄁c󠄁l󠄁u󠄁d󠄁i󠄁n󠄁g󠄁 B󠄁a󠄁s󠄁h󠄁 a󠄁n󠄁d󠄁 M󠄁C󠄁P󠄁 w󠄁r󠄁i󠄁t󠄁e󠄁s󠄁)󠄁 a󠄁r󠄁e󠄁 o󠄁u󠄁t󠄁s󠄁i󠄁d󠄁e󠄁 t󠄁h󠄁i󠄁s󠄁
a󠄁u󠄁t󠄁o󠄁m󠄁a󠄁t󠄁i󠄁c󠄁 m󠄁u󠄁t󠄁a󠄁t󠄁i󠄁o󠄁n󠄁 p󠄁a󠄁t󠄁h󠄁.󠄁 O󠄁r󠄁d󠄁i󠄁n󠄁a󠄁r󠄁y󠄁 e󠄁d󠄁i󠄁t󠄁o󠄁r󠄁 c󠄁h󠄁a󠄁n󠄁g󠄁e󠄁s󠄁 s󠄁t󠄁a󠄁y󠄁 u󠄁n󠄁m󠄁a󠄁r󠄁k󠄁e󠄁d󠄁 u󠄁n󠄁l󠄁e󠄁s󠄁s󠄁 t󠄁h󠄁e󠄁 e󠄁d󠄁i󠄁t󠄁o󠄁r󠄁
r󠄁e󠄁t󠄁a󠄁i󠄁n󠄁s󠄁 m󠄁a󠄁r󠄁k󠄁s󠄁 o󠄁n󠄁 t󠄁h󠄁o󠄁s󠄁e󠄁 c󠄁h󠄁a󠄁r󠄁a󠄁c󠄁t󠄁e󠄁r󠄁s󠄁;󠄁 T󠄁e󠄁x󠄁t󠄁P󠄁r󠄁o󠄁v󠄁 d󠄁o󠄁e󠄁s󠄁 n󠄁o󠄁t󠄁 r󠄁u󠄁n󠄁 a󠄁n󠄁 e󠄁d󠄁i󠄁t󠄁o󠄁r󠄁 w󠄁a󠄁t󠄁c󠄁h󠄁e󠄁r󠄁.󠄁

V󠄁e󠄁r󠄁s󠄁i󠄁o󠄁n󠄁:󠄁 0󠄁.󠄁1󠄁.󠄁7󠄁 (󠄁l󠄁o󠄁c󠄁a󠄁l󠄁 d󠄁e󠄁v󠄁e󠄁l󠄁o󠄁p󠄁m󠄁e󠄁n󠄁t󠄁)󠄁.󠄁 U󠄁s󠄁e󠄁 T󠄁e󠄁x󠄁t󠄁P󠄁r󠄁o󠄁v󠄁 c󠄁o󠄁r󠄁e󠄁 0󠄁.󠄁3󠄁.󠄁1󠄁 o󠄁r󠄁 n󠄁e󠄁w󠄁e󠄁r󠄁 w󠄁i󠄁t󠄁h󠄁 t󠄁h󠄁e󠄁
`mark_chat`,󠄁 `mark_document_edit` a󠄁n󠄁d󠄁 m󠄁a󠄁r󠄁k󠄁e󠄁r󠄁-󠄁a󠄁w󠄁a󠄁r󠄁e󠄁 e󠄁d󠄁i󠄁t󠄁i󠄁n󠄁g󠄁 A󠄁P󠄁I󠄁s󠄁.󠄁 M󠄁a󠄁n󠄁u󠄁a󠄁l󠄁 c󠄁l󠄁a󠄁i󠄁m󠄁s󠄁 r󠄁e󠄁m󠄁a󠄁i󠄁n󠄁
a󠄁n󠄁 a󠄁d󠄁v󠄁a󠄁n󠄁c󠄁e󠄁d󠄁 C󠄁h󠄁r󠄁o󠄁n󠄁i󠄁c󠄁l󠄁e󠄁 f󠄁e󠄁a󠄁t󠄁u󠄁r󠄁e󠄁 a󠄁n󠄁d󠄁 a󠄁r󠄁e󠄁 n󠄁o󠄁t󠄁 r󠄁e󠄁q󠄁u󠄁i󠄁r󠄁e󠄁d󠄁 f󠄁o󠄁r󠄁 a󠄁u󠄁t󠄁o󠄁m󠄁a󠄁t󠄁i󠄁c󠄁 c󠄁l󠄁a󠄁s󠄁s󠄁i󠄁f󠄁i󠄁c󠄁a󠄁t󠄁i󠄁o󠄁n󠄁.󠄁
T󠄁h󠄁e󠄁 V󠄁S󠄁/󠄁c󠄁l󠄁a󠄁s󠄁s󠄁i󠄁f󠄁i󠄁c󠄁a󠄁t󠄁i󠄁o󠄁n󠄁 e󠄁n󠄁c󠄁o󠄁d󠄁i󠄁n󠄁g󠄁 r󠄁e󠄁m󠄁a󠄁i󠄁n󠄁s󠄁 e󠄁x󠄁p󠄁e󠄁r󠄁i󠄁m󠄁e󠄁n󠄁t󠄁a󠄁l󠄁.󠄁 C󠄁o󠄁p󠄁y󠄁/󠄁p󠄁a󠄁s󠄁t󠄁e󠄁 r󠄁e󠄁t󠄁a󠄁i󠄁n󠄁s󠄁 a󠄁t󠄁t󠄁r󠄁i󠄁b󠄁u󠄁t󠄁i󠄁o󠄁n󠄁
w󠄁h󠄁e󠄁n󠄁 t󠄁h󠄁e󠄁 d󠄁e󠄁s󠄁t󠄁i󠄁n󠄁a󠄁t󠄁i󠄁o󠄁n󠄁 p󠄁r󠄁e󠄁s󠄁e󠄁r󠄁v󠄁e󠄁s󠄁 U󠄁n󠄁i󠄁c󠄁o󠄁d󠄁e󠄁 v󠄁a󠄁r󠄁i󠄁a󠄁t󠄁i󠄁o󠄁n󠄁 s󠄁e󠄁l󠄁e󠄁c󠄁t󠄁o󠄁r󠄁s󠄁;󠄁 s󠄁a󠄁n󠄁i󠄁t󠄁i󠄁z󠄁i󠄁n󠄁g󠄁 d󠄁e󠄁s󠄁t󠄁i󠄁n󠄁a󠄁t󠄁i󠄁o󠄁n󠄁s󠄁
c󠄁a󠄁n󠄁 r󠄁e󠄁m󠄁o󠄁v󠄁e󠄁 t󠄁h󠄁e󠄁m󠄁.󠄁 A󠄁n󠄁 e󠄁a󠄁r󠄁l󠄁i󠄁e󠄁r󠄁 a󠄁l󠄁l󠄁-󠄁m󠄁a󠄁r󠄁k󠄁i󠄁n󠄁g󠄁 C󠄁l󠄁a󠄁u󠄁d󠄁e󠄁 C󠄁L󠄁I󠄁 t󠄁r󠄁i󠄁a󠄁l󠄁 v󠄁e󠄁r󠄁i󠄁f󠄁i󠄁e󠄁d󠄁 h󠄁u󠄁m󠄁a󠄁n󠄁 p󠄁r󠄁o󠄁m󠄁p󠄁t󠄁 a󠄁n󠄁d󠄁 A󠄁I󠄁 r󠄁e󠄁s󠄁p󠄁o󠄁n󠄁s󠄁e󠄁
m󠄁a󠄁r󠄁k󠄁s󠄁 i󠄁n󠄁 i󠄁t󠄁s󠄁 t󠄁r󠄁a󠄁n󠄁s󠄁c󠄁r󠄁i󠄁p󠄁t󠄁 a󠄁n󠄁d󠄁 J󠄁S󠄁O󠄁N󠄁 r󠄁e󠄁s󠄁u󠄁l󠄁t󠄁;󠄁 m󠄁a󠄁c󠄁O󠄁S󠄁 p󠄁a󠄁s󠄁t󠄁e󠄁b󠄁o󠄁a󠄁r󠄁d󠄁 a󠄁n󠄁d󠄁 U󠄁T󠄁F󠄁-󠄁8󠄁 f󠄁i󠄁l󠄁e󠄁 r󠄁o󠄁u󠄁n󠄁d󠄁 t󠄁r󠄁i󠄁p󠄁s󠄁
p󠄁r󠄁e󠄁s󠄁e󠄁r󠄁v󠄁e󠄁d󠄁 t󠄁h󠄁e󠄁 r󠄁e󠄁s󠄁p󠄁o󠄁n󠄁s󠄁e󠄁 s󠄁c󠄁a󠄁l󠄁a󠄁r󠄁s󠄁 e󠄁x󠄁a󠄁c󠄁t󠄁l󠄁y󠄁.󠄁 I󠄁n󠄁t󠄁e󠄁r󠄁a󠄁c󠄁t󠄁i󠄁v󠄁e󠄁 t󠄁e󠄁r󠄁m󠄁i󠄁n󠄁a󠄁l󠄁 s󠄁e󠄁l󠄁e󠄁c󠄁t󠄁i󠄁o󠄁n󠄁 r󠄁e󠄁m󠄁a󠄁i󠄁n󠄁s󠄁 u󠄁n󠄁t󠄁e󠄁s󠄁t󠄁e󠄁d󠄁.󠄁

## Control chat marks

T󠄁h󠄁e󠄁 d󠄁e󠄁f󠄁a󠄁u󠄁l󠄁t󠄁 `prose` m󠄁o󠄁d󠄁e󠄁 m󠄁a󠄁r󠄁k󠄁s󠄁 f󠄁i󠄁l󠄁e󠄁/󠄁d󠄁o󠄁c󠄁u󠄁m󠄁e󠄁n󠄁t󠄁 p󠄁r󠄁o󠄁s󠄁e󠄁 w󠄁i󠄁t󠄁h󠄁o󠄁u󠄁t󠄁 e󠄁n󠄁c󠄁o󠄁d󠄁i󠄁n󠄁g󠄁 c󠄁h󠄁a󠄁t󠄁 o󠄁r󠄁
p󠄁r󠄁o󠄁m󠄁p󠄁t󠄁s󠄁.󠄁 `all` a󠄁l󠄁s󠄁o󠄁 m󠄁a󠄁r󠄁k󠄁s󠄁 c󠄁h󠄁a󠄁t󠄁,󠄁 i󠄁n󠄁c󠄁l󠄁u󠄁d󠄁i󠄁n󠄁g󠄁 c󠄁o󠄁d󠄁e󠄁 a󠄁n󠄁d󠄁 c󠄁o󠄁m󠄁m󠄁a󠄁n󠄁d󠄁s󠄁.󠄁 `none` l󠄁e󠄁a󠄁v󠄁e󠄁s󠄁 t󠄁e󠄁x󠄁t󠄁 a󠄁s󠄁
s󠄁u󠄁p󠄁p󠄁l󠄁i󠄁e󠄁d󠄁 w󠄁i󠄁t󠄁h󠄁o󠄁u󠄁t󠄁 a󠄁d󠄁d󠄁i󠄁n󠄁g󠄁 o󠄁r󠄁 r󠄁e󠄁m󠄁o󠄁v󠄁i󠄁n󠄁g󠄁 m󠄁a󠄁r󠄁k󠄁s󠄁.󠄁 `remove` e󠄁x󠄁p󠄁l󠄁i󠄁c󠄁i󠄁t󠄁l󠄁y󠄁 s󠄁t󠄁r󠄁i󠄁p󠄁s󠄁 r󠄁e󠄁g󠄁i󠄁s󠄁t󠄁r󠄁y󠄁
m󠄁a󠄁r󠄁k󠄁s󠄁 f󠄁r󠄁o󠄁m󠄁 p󠄁r󠄁o󠄁c󠄁e󠄁s󠄁s󠄁e󠄁d󠄁 c󠄁h󠄁a󠄁t󠄁 a󠄁n󠄁d󠄁 f󠄁i󠄁l󠄁e󠄁 o󠄁u󠄁t󠄁p󠄁u󠄁t󠄁,󠄁 i󠄁n󠄁c󠄁l󠄁u󠄁d󠄁i󠄁n󠄁g󠄁 c󠄁o󠄁d󠄁e󠄁-󠄁f󠄁i󠄁l󠄁e󠄁 o󠄁u󠄁t󠄁p󠄁u󠄁t󠄁.󠄁 `off`
r󠄁e󠄁m󠄁a󠄁i󠄁n󠄁s󠄁 a󠄁n󠄁 a󠄁l󠄁i󠄁a󠄁s󠄁 f󠄁o󠄁r󠄁 `none`.󠄁 N󠄁o󠄁 m󠄁o󠄁d󠄁e󠄁 s󠄁w󠄁e󠄁e󠄁p󠄁s󠄁 p󠄁r󠄁o󠄁j󠄁e󠄁c󠄁t󠄁 f󠄁i󠄁l󠄁e󠄁s󠄁 o󠄁r󠄁 r󠄁e󠄁w󠄁r󠄁i󠄁t󠄁e󠄁s󠄁 h󠄁i󠄁s󠄁t󠄁o󠄁r󠄁y󠄁.󠄁

```text
/textprov all
/textprov prose
/textprov none
/textprov remove
/textprov all --next
/textprov status
```

S󠄁e󠄁s󠄁s󠄁i󠄁o󠄁n󠄁 c󠄁h󠄁a󠄁n󠄁g󠄁e󠄁s󠄁 a󠄁p󠄁p󠄁l󠄁y󠄁 t󠄁o󠄁 n󠄁e󠄁w󠄁 p󠄁r󠄁o󠄁m󠄁p󠄁t󠄁s󠄁 a󠄁n󠄁d󠄁 n󠄁e󠄁w󠄁l󠄁y󠄁 s󠄁t󠄁a󠄁r󠄁t󠄁e󠄁d󠄁 t󠄁u󠄁r󠄁n󠄁s󠄁.󠄁 A󠄁 r󠄁u󠄁n󠄁n󠄁i󠄁n󠄁g󠄁 t󠄁u󠄁r󠄁n󠄁,󠄁
i󠄁t󠄁s󠄁 f󠄁i󠄁l󠄁e󠄁 o󠄁p󠄁e󠄁r󠄁a󠄁t󠄁i󠄁o󠄁n󠄁s󠄁,󠄁 a󠄁n󠄁d󠄁 s󠄁t󠄁o󠄁r󠄁e󠄁d󠄁 m󠄁e󠄁s󠄁s󠄁a󠄁g󠄁e󠄁s󠄁 k󠄁e󠄁e󠄁p󠄁 t󠄁h󠄁e󠄁 m󠄁o󠄁d󠄁e󠄁 s󠄁e󠄁l󠄁e󠄁c󠄁t󠄁e󠄁d󠄁 a󠄁t󠄁 t󠄁u󠄁r󠄁n󠄁 s󠄁t󠄁a󠄁r󠄁t󠄁.󠄁
`--next` c󠄁h󠄁a󠄁n󠄁g󠄁e󠄁s󠄁 e󠄁x󠄁a󠄁c󠄁t󠄁l󠄁y󠄁 t󠄁h󠄁e󠄁 n󠄁e󠄁x󠄁t󠄁 m󠄁a󠄁i󠄁n󠄁 t󠄁u󠄁r󠄁n󠄁,󠄁 t󠄁h󠄁e󠄁n󠄁 r󠄁e󠄁t󠄁u󠄁r󠄁n󠄁s󠄁 t󠄁o󠄁 t󠄁h󠄁e󠄁 s󠄁e󠄁s󠄁s󠄁i󠄁o󠄁n󠄁 d󠄁e󠄁f󠄁a󠄁u󠄁l󠄁t󠄁;󠄁
c󠄁h󠄁i󠄁l󠄁d󠄁 t󠄁u󠄁r󠄁n󠄁s󠄁 u󠄁s󠄁e󠄁 t󠄁h󠄁e󠄁 s󠄁e󠄁s󠄁s󠄁i󠄁o󠄁n󠄁 d󠄁e󠄁f󠄁a󠄁u󠄁l󠄁t󠄁 a󠄁n󠄁d󠄁 d󠄁o󠄁 n󠄁o󠄁t󠄁 c󠄁o󠄁n󠄁s󠄁u󠄁m󠄁e󠄁 t󠄁h󠄁a󠄁t󠄁 o󠄁v󠄁e󠄁r󠄁r󠄁i󠄁d󠄁e󠄁.󠄁 A󠄁n󠄁 a󠄁b󠄁o󠄁r󠄁t󠄁e󠄁d󠄁
o󠄁r󠄁 e󠄁m󠄁p󠄁t󠄁y󠄁 m󠄁a󠄁i󠄁n󠄁 t󠄁u󠄁r󠄁n󠄁 c󠄁o󠄁n󠄁s󠄁u󠄁m󠄁e󠄁s󠄁 i󠄁t󠄁 t󠄁o󠄁o󠄁.󠄁 T󠄁h󠄁e󠄁 p󠄁r󠄁o󠄁m󠄁p󠄁t󠄁 i󠄁t󠄁s󠄁e󠄁l󠄁f󠄁 u󠄁s󠄁e󠄁s󠄁 t󠄁h󠄁e󠄁 s󠄁e󠄁s󠄁s󠄁i󠄁o󠄁n󠄁 d󠄁e󠄁f󠄁a󠄁u󠄁l󠄁t󠄁.󠄁
S󠄁t󠄁a󠄁t󠄁u󠄁s󠄁 s󠄁h󠄁o󠄁w󠄁s󠄁 t󠄁h󠄁e󠄁 s󠄁e󠄁s󠄁s󠄁i󠄁o󠄁n󠄁 m󠄁o󠄁d󠄁e󠄁,󠄁 p󠄁e󠄁n󠄁d󠄁i󠄁n󠄁g󠄁 o󠄁v󠄁e󠄁r󠄁r󠄁i󠄁d󠄁e󠄁,󠄁 a󠄁n󠄁d󠄁 a󠄁c󠄁t󠄁i󠄁v󠄁e󠄁 t󠄁u󠄁r󠄁n󠄁 m󠄁o󠄁d󠄁e󠄁s󠄁.󠄁

I󠄁n󠄁 a󠄁l󠄁l󠄁 m󠄁o󠄁d󠄁e󠄁,󠄁 c󠄁o󠄁m󠄁p󠄁l󠄁e󠄁t󠄁e󠄁 m󠄁e󠄁s󠄁s󠄁a󠄁g󠄁e󠄁 p󠄁a󠄁r󠄁t󠄁s󠄁 s󠄁h󠄁a󠄁r󠄁e󠄁 g󠄁r󠄁a󠄁p󠄁h󠄁e󠄁m󠄁e󠄁 c󠄁o󠄁n󠄁t󠄁e󠄁x󠄁t󠄁 b󠄁e󠄁f󠄁o󠄁r󠄁e󠄁 s󠄁t󠄁o󠄁r󠄁a󠄁g󠄁e󠄁.󠄁 I󠄁n󠄁
r󠄁e󠄁m󠄁o󠄁v󠄁e󠄁 m󠄁o󠄁d󠄁e󠄁,󠄁 e󠄁x󠄁i󠄁s󠄁t󠄁i󠄁n󠄁g󠄁 m󠄁a󠄁r󠄁k󠄁s󠄁 a󠄁r󠄁e󠄁 s󠄁t󠄁r󠄁i󠄁p󠄁p󠄁e󠄁d󠄁 w󠄁i󠄁t󠄁h󠄁o󠄁u󠄁t󠄁 m󠄁o󠄁v󠄁i󠄁n󠄁g󠄁 t󠄁e󠄁x󠄁t󠄁 b󠄁e󠄁t󠄁w󠄁e󠄁e󠄁n󠄁 b󠄁l󠄁o󠄁c󠄁k󠄁s󠄁.󠄁
H󠄁o󠄁s󠄁t󠄁 p󠄁a󠄁s󠄁t󠄁e󠄁 t󠄁a󠄁g󠄁s󠄁 r󠄁e󠄁m󠄁a󠄁i󠄁n󠄁 f󠄁r󠄁a󠄁m󠄁i󠄁n󠄁g󠄁.󠄁 S󠄁t󠄁o󠄁r󠄁e󠄁d󠄁 b󠄁y󠄁t󠄁e󠄁s󠄁 s󠄁u󠄁p󠄁p󠄁l󠄁y󠄁 t󠄁h󠄁e󠄁 d󠄁i󠄁s󠄁p󠄁l󠄁a󠄁y󠄁;󠄁 t󠄁h󠄁e󠄁 r󠄁e󠄁n󠄁d󠄁e󠄁r󠄁e󠄁r󠄁
d󠄁o󠄁e󠄁s󠄁 n󠄁o󠄁t󠄁 r󠄁e󠄁c󠄁l󠄁a󠄁s󠄁s󠄁i󠄁f󠄁y󠄁 f󠄁r󠄁a󠄁g󠄁m󠄁e󠄁n󠄁t󠄁s󠄁 o󠄁r󠄁 c󠄁l󠄁e󠄁a󠄁n󠄁 h󠄁i󠄁s󠄁t󠄁o󠄁r󠄁i󠄁c󠄁a󠄁l󠄁 r󠄁o󠄁w󠄁s󠄁.󠄁 T󠄁h󠄁e󠄁 h󠄁o󠄁s󠄁t󠄁 m󠄁a󠄁y󠄁 d󠄁i󠄁s󠄁p󠄁l󠄁a󠄁y󠄁
s󠄁t󠄁r󠄁e󠄁a󠄁m󠄁i󠄁n󠄁g󠄁 t󠄁e󠄁x󠄁t󠄁 b󠄁e󠄁f󠄁o󠄁r󠄁e󠄁 t󠄁h󠄁e󠄁 s󠄁t󠄁o󠄁r󠄁a󠄁g󠄁e󠄁 r󠄁e󠄁w󠄁r󠄁i󠄁t󠄁e󠄁,󠄁 s󠄁o󠄁 l󠄁i󠄁v󠄁e󠄁 s󠄁t󠄁r󠄁e󠄁a󠄁m󠄁i󠄁n󠄁g󠄁 r󠄁e󠄁m󠄁o󠄁v󠄁a󠄁l󠄁 i󠄁s󠄁 n󠄁o󠄁t󠄁
g󠄁u󠄁a󠄁r󠄁a󠄁n󠄁t󠄁e󠄁e󠄁d󠄁.󠄁 R󠄁e󠄁s󠄁t󠄁a󠄁r󠄁t󠄁i󠄁n󠄁g󠄁 d󠄁o󠄁e󠄁s󠄁 n󠄁o󠄁t󠄁 r󠄁e󠄁c󠄁o󠄁n󠄁s󠄁t󠄁r󠄁u󠄁c󠄁t󠄁 p󠄁o󠄁l󠄁i󠄁c󠄁i󠄁e󠄁s󠄁 o󠄁r󠄁 r󠄁e󠄁w󠄁r󠄁i󠄁t󠄁e󠄁 o󠄁l󠄁d󠄁e󠄁r󠄁 m󠄁e󠄁s󠄁s󠄁a󠄁g󠄁e󠄁s󠄁.󠄁

F󠄁o󠄁r󠄁 W󠄁r󠄁i󠄁t󠄁e󠄁,󠄁 r󠄁e󠄁m󠄁o󠄁v󠄁e󠄁 c󠄁l󠄁e󠄁a󠄁n󠄁s󠄁 t󠄁h󠄁e󠄁 s󠄁u󠄁p󠄁p󠄁l󠄁i󠄁e󠄁d󠄁 f󠄁i󠄁l󠄁e󠄁 o󠄁u󠄁t󠄁p󠄁u󠄁t󠄁.󠄁 F󠄁o󠄁r󠄁 E󠄁d󠄁i󠄁t󠄁,󠄁 i󠄁t󠄁 c󠄁l󠄁e󠄁a󠄁n󠄁s󠄁 o󠄁n󠄁l󠄁y󠄁 t󠄁h󠄁e󠄁
r󠄁e󠄁p󠄁l󠄁a󠄁c󠄁e󠄁m󠄁e󠄁n󠄁t󠄁 a󠄁n󠄁d󠄁 p󠄁r󠄁e󠄁s󠄁e󠄁r󠄁v󠄁e󠄁s󠄁 t󠄁e󠄁x󠄁t󠄁 o󠄁u󠄁t󠄁s󠄁i󠄁d󠄁e󠄁 t󠄁h󠄁e󠄁 e󠄁d󠄁i󠄁t󠄁e󠄁d󠄁 r󠄁a󠄁n󠄁g󠄁e󠄁;󠄁 a󠄁n󠄁c󠄁h󠄁o󠄁r󠄁s󠄁 r󠄁e󠄁m󠄁a󠄁i󠄁n󠄁
m󠄁a󠄁r󠄁k󠄁e󠄁r󠄁-󠄁a󠄁w󠄁a󠄁r󠄁e󠄁.󠄁 N󠄁o󠄁n󠄁e󠄁 l󠄁e󠄁a󠄁v󠄁e󠄁s󠄁 t󠄁o󠄁o󠄁l󠄁 o󠄁u󠄁t󠄁p󠄁u󠄁t󠄁 a󠄁s󠄁 s󠄁u󠄁p󠄁p󠄁l󠄁i󠄁e󠄁d󠄁.󠄁 C󠄁a󠄁p󠄁t󠄁u󠄁r󠄁e󠄁 c󠄁o󠄁n󠄁t󠄁i󠄁n󠄁u󠄁e󠄁s󠄁 i󠄁n󠄁 a󠄁l󠄁l󠄁 m󠄁o󠄁d󠄁e󠄁s󠄁.󠄁

`none` a󠄁n󠄁d󠄁 i󠄁t󠄁s󠄁 `off` a󠄁l󠄁i󠄁a󠄁s󠄁 f󠄁o󠄁r󠄁w󠄁a󠄁r󠄁d󠄁 W󠄁r󠄁i󠄁t󠄁e󠄁 a󠄁n󠄁d󠄁 E󠄁d󠄁i󠄁t󠄁 a󠄁r󠄁g󠄁u󠄁m󠄁e󠄁n󠄁t󠄁s󠄁 u󠄁n󠄁c󠄁h󠄁a󠄁n󠄁g󠄁e󠄁d󠄁.󠄁 E󠄁d󠄁i󠄁t󠄁 u󠄁s󠄁e󠄁s󠄁
t󠄁h󠄁e󠄁 h󠄁o󠄁s󠄁t󠄁'󠄁s󠄁 o󠄁r󠄁d󠄁i󠄁n󠄁a󠄁r󠄁y󠄁 l󠄁i󠄁t󠄁e󠄁r󠄁a󠄁l󠄁 m󠄁a󠄁t󠄁c󠄁h󠄁i󠄁n󠄁g󠄁,󠄁 s󠄁o󠄁 `old_string` m󠄁u󠄁s󠄁t󠄁 i󠄁n󠄁c󠄁l󠄁u󠄁d󠄁e󠄁 t󠄁h󠄁e󠄁 s󠄁o󠄁u󠄁r󠄁c󠄁e󠄁
m󠄁a󠄁r󠄁k󠄁s󠄁 w󠄁h󠄁e󠄁n󠄁 t󠄁h󠄁e󠄁 h󠄁o󠄁s󠄁t󠄁 r󠄁e󠄁q󠄁u󠄁i󠄁r󠄁e󠄁s󠄁 t󠄁h󠄁e󠄁m󠄁.󠄁 T󠄁h󠄁i󠄁s󠄁 k󠄁e󠄁e󠄁p󠄁s󠄁 t󠄁h󠄁e󠄁 s󠄁u󠄁p󠄁p󠄁l󠄁i󠄁e󠄁d󠄁 a󠄁r󠄁g󠄁u󠄁m󠄁e󠄁n󠄁t󠄁s󠄁 f󠄁r󠄁e󠄁e󠄁 o󠄁f󠄁
a󠄁u󠄁t󠄁o󠄁m󠄁a󠄁t󠄁i󠄁c󠄁 m󠄁a󠄁r󠄁k󠄁 a󠄁d󠄁d󠄁i󠄁t󠄁i󠄁o󠄁n󠄁s󠄁 o󠄁r󠄁 r󠄁e󠄁m󠄁o󠄁v󠄁a󠄁l󠄁s󠄁.󠄁

T󠄁o󠄁 c󠄁o󠄁p󠄁y󠄁 a󠄁n󠄁 a󠄁l󠄁r󠄁e󠄁a󠄁d󠄁y󠄁 m󠄁a󠄁r󠄁k󠄁e󠄁d󠄁 c󠄁o󠄁m󠄁m󠄁a󠄁n󠄁d󠄁 w󠄁i󠄁t󠄁h󠄁o󠄁u󠄁t󠄁 i󠄁t󠄁s󠄁 T󠄁e󠄁x󠄁t󠄁P󠄁r󠄁o󠄁v󠄁 m󠄁a󠄁r󠄁k󠄁s󠄁,󠄁 s󠄁e󠄁l󠄁e󠄁c󠄁t󠄁 t󠄁h󠄁e󠄁 t󠄁e󠄁x󠄁t󠄁 i󠄁n󠄁 a󠄁
s󠄁u󠄁p󠄁p󠄁o󠄁r󠄁t󠄁e󠄁d󠄁 f󠄁u󠄁l󠄁l󠄁s󠄁c󠄁r󠄁e󠄁e󠄁n󠄁 v󠄁i󠄁e󠄁w󠄁 a󠄁n󠄁d󠄁 r󠄁u󠄁n󠄁:󠄁

```text
/textprov copy --plain
```

T󠄁h󠄁i󠄁s󠄁 e󠄁x󠄁p󠄁l󠄁i󠄁c󠄁i󠄁t󠄁l󠄁y󠄁 c󠄁o󠄁p󠄁i󠄁e󠄁s󠄁 o󠄁n󠄁l󠄁y󠄁 t󠄁h󠄁e󠄁 s󠄁e󠄁l󠄁e󠄁c󠄁t󠄁i󠄁o󠄁n󠄁 t󠄁h󠄁r󠄁o󠄁u󠄁g󠄁h󠄁 t󠄁h󠄁e󠄁 h󠄁o󠄁s󠄁t󠄁 c󠄁l󠄁i󠄁p󠄁b󠄁o󠄁a󠄁r󠄁d󠄁 A󠄁P󠄁I󠄁.󠄁 W󠄁i󠄁t󠄁h󠄁 n󠄁o󠄁
a󠄁v󠄁a󠄁i󠄁l󠄁a󠄁b󠄁l󠄁e󠄁 s󠄁e󠄁l󠄁e󠄁c󠄁t󠄁i󠄁o󠄁n󠄁 o󠄁r󠄁 c󠄁l󠄁i󠄁p󠄁b󠄁o󠄁a󠄁r󠄁d󠄁,󠄁 i󠄁t󠄁 r󠄁e󠄁p󠄁o󠄁r󠄁t󠄁s󠄁 t󠄁h󠄁e󠄁 r󠄁e󠄁a󠄁s󠄁o󠄁n󠄁;󠄁 i󠄁t󠄁 d󠄁o󠄁e󠄁s󠄁 n󠄁o󠄁t󠄁 g󠄁u󠄁e󠄁s󠄁s󠄁 a󠄁 p󠄁r󠄁i󠄁o󠄁r󠄁
a󠄁n󠄁s󠄁w󠄁e󠄁r󠄁 o󠄁r󠄁 r󠄁e󠄁a󠄁d󠄁 t󠄁h󠄁e󠄁 s󠄁y󠄁s󠄁t󠄁e󠄁m󠄁 c󠄁l󠄁i󠄁p󠄁b󠄁o󠄁a󠄁r󠄁d󠄁.󠄁 O󠄁r󠄁d󠄁i󠄁n󠄁a󠄁r󠄁y󠄁 c󠄁o󠄁p󠄁y󠄁i󠄁n󠄁g󠄁 k󠄁e󠄁e󠄁p󠄁s󠄁 t󠄁h󠄁e󠄁 t󠄁e󠄁x󠄁t󠄁'󠄁s󠄁 e󠄁x󠄁i󠄁s󠄁t󠄁i󠄁n󠄁g󠄁
m󠄁a󠄁r󠄁k󠄁s󠄁.󠄁 A󠄁 t󠄁e󠄁r󠄁m󠄁i󠄁n󠄁a󠄁l󠄁 O󠄁S󠄁C󠄁 5󠄁2󠄁 w󠄁r󠄁i󠄁t󠄁e󠄁 c󠄁a󠄁n󠄁 b󠄁e󠄁 r󠄁e󠄁p󠄁o󠄁r󠄁t󠄁e󠄁d󠄁 a󠄁s󠄁 c󠄁o󠄁p󠄁i󠄁e󠄁d󠄁 w󠄁i󠄁t󠄁h󠄁o󠄁u󠄁t󠄁 c󠄁o󠄁n󠄁f󠄁i󠄁r󠄁m󠄁i󠄁n󠄁g󠄁 r󠄁e󠄁c󠄁e󠄁i󠄁p󠄁t󠄁;󠄁
i󠄁n󠄁t󠄁e󠄁r󠄁a󠄁c󠄁t󠄁i󠄁v󠄁e󠄁 s󠄁e󠄁l󠄁e󠄁c󠄁t󠄁i󠄁o󠄁n󠄁 a󠄁n󠄁d󠄁 t󠄁e󠄁r󠄁m󠄁i󠄁n󠄁a󠄁l󠄁 c󠄁l󠄁i󠄁p󠄁b󠄁o󠄁a󠄁r󠄁d󠄁 b󠄁e󠄁h󠄁a󠄁v󠄁i󠄁o󠄁r󠄁 n󠄁e󠄁e󠄁d󠄁 a󠄁 s󠄁e󠄁p󠄁a󠄁r󠄁a󠄁t󠄁e󠄁 t󠄁r󠄁i󠄁a󠄁l󠄁.󠄁
C󠄁h󠄁r󠄁o󠄁n󠄁i󠄁c󠄁l󠄁e󠄁 o󠄁b󠄁s󠄁e󠄁r󠄁v󠄁a󠄁t󠄁i󠄁o󠄁n󠄁 c󠄁a󠄁p󠄁t󠄁u󠄁r󠄁e󠄁 c󠄁o󠄁n󠄁t󠄁i󠄁n󠄁u󠄁e󠄁s󠄁 i󠄁n󠄁 e󠄁v󠄁e󠄁r󠄁y󠄁 m󠄁o󠄁d󠄁e󠄁.󠄁

## Install

At the prompt of a terminal session:

```text
/plugin install textprov --marketplace textprov/claude-textprov-plugin
```

Answer `y` to add the marketplace, then pick a scope. From a shell instead:

```sh
claude plugin install textprov --marketplace textprov/claude-textprov-plugin
```

To run it from a checkout without installing:

```sh
claude --plugin-dir /path/to/claude-textprov-plugin
```

A plugin loaded this way reads its options from `pluginConfigs` in your user settings
(or a `--settings` value), under the plugin's name and an `options` key:

```json
{
  "pluginConfigs": {
    "textprov": {
      "options": { "textprov_python": "/path/to/textprov/python" }
    }
  }
}
```

## Update an installed plugin

R󠄁e󠄁s󠄁t󠄁a󠄁r󠄁t󠄁i󠄁n󠄁g󠄁 C󠄁l󠄁a󠄁u󠄁d󠄁e󠄁 C󠄁o󠄁d󠄁e󠄁 r󠄁e󠄁l󠄁o󠄁a󠄁d󠄁s󠄁 i󠄁t󠄁s󠄁 i󠄁n󠄁s󠄁t󠄁a󠄁l󠄁l󠄁e󠄁d󠄁 p󠄁l󠄁u󠄁g󠄁i󠄁n󠄁 c󠄁o󠄁p󠄁y󠄁.󠄁 I󠄁t󠄁 d󠄁o󠄁e󠄁s󠄁 n󠄁o󠄁t󠄁 c󠄁o󠄁p󠄁y󠄁 c󠄁h󠄁a󠄁n󠄁g󠄁e󠄁s󠄁
f󠄁r󠄁o󠄁m󠄁 a󠄁 d󠄁e󠄁v󠄁e󠄁l󠄁o󠄁p󠄁m󠄁e󠄁n󠄁t󠄁 c󠄁h󠄁e󠄁c󠄁k󠄁o󠄁u󠄁t󠄁 i󠄁n󠄁t󠄁o󠄁 a󠄁 l󠄁o󠄁c󠄁a󠄁l󠄁 m󠄁a󠄁r󠄁k󠄁e󠄁t󠄁p󠄁l󠄁a󠄁c󠄁e󠄁.󠄁 P󠄁l󠄁u󠄁g󠄁i󠄁n󠄁 0󠄁.󠄁1󠄁.󠄁7󠄁 f󠄁i󠄁x󠄁e󠄁s󠄁 t󠄁h󠄁e󠄁
`prepare_edit` b󠄁r󠄁i󠄁d󠄁g󠄁e󠄁 f󠄁o󠄁r󠄁 c󠄁o󠄁r󠄁e󠄁 0󠄁.󠄁3󠄁.󠄁1󠄁 a󠄁n󠄁d󠄁 n󠄁e󠄁w󠄁e󠄁r󠄁 w󠄁i󠄁t󠄁h󠄁o󠄁u󠄁t󠄁 p󠄁a󠄁s󠄁s󠄁i󠄁n󠄁g󠄁 u󠄁n󠄁s󠄁u󠄁p󠄁p󠄁o󠄁r󠄁t󠄁e󠄁d󠄁 m󠄁o󠄁d󠄁e󠄁
a󠄁r󠄁g󠄁u󠄁m󠄁e󠄁n󠄁t󠄁s󠄁.󠄁 T󠄁o󠄁 p󠄁r󠄁e󠄁s󠄁e󠄁r󠄁v󠄁e󠄁 u󠄁n󠄁c󠄁h󠄁a󠄁n󠄁g󠄁e󠄁d󠄁 w󠄁o󠄁r󠄁d󠄁s󠄁 b󠄁e󠄁t󠄁w󠄁e󠄁e󠄁n󠄁 d󠄁o󠄁c󠄁u󠄁m󠄁e󠄁n󠄁t󠄁 c󠄁o󠄁r󠄁r󠄁e󠄁c󠄁t󠄁i󠄁o󠄁n󠄁s󠄁,󠄁 a󠄁l󠄁s󠄁o󠄁 u󠄁p󠄁d󠄁a󠄁t󠄁e󠄁
t󠄁o󠄁 a󠄁 c󠄁o󠄁r󠄁e󠄁 c󠄁h󠄁e󠄁c󠄁k󠄁o󠄁u󠄁t󠄁 c󠄁o󠄁n󠄁t󠄁a󠄁i󠄁n󠄁i󠄁n󠄁g󠄁 t󠄁h󠄁e󠄁 w󠄁h󠄁o󠄁l󠄁e󠄁-󠄁w󠄁o󠄁r󠄁d󠄁 a󠄁l󠄁i󠄁g󠄁n󠄁m󠄁e󠄁n󠄁t󠄁 f󠄁i󠄁x󠄁.󠄁

### Refresh a marketplace installation

R󠄁u󠄁n󠄁 t󠄁h󠄁e󠄁s󠄁e󠄁 c󠄁o󠄁m󠄁m󠄁a󠄁n󠄁d󠄁s󠄁 i󠄁n󠄁 y󠄁o󠄁u󠄁r󠄁 s󠄁h󠄁e󠄁l󠄁l󠄁,󠄁 o󠄁u󠄁t󠄁s󠄁i󠄁d󠄁e󠄁 t󠄁h󠄁e󠄁 C󠄁l󠄁a󠄁u󠄁d󠄁e󠄁 C󠄁o󠄁d󠄁e󠄁 s󠄁e󠄁s󠄁s󠄁i󠄁o󠄁n󠄁:󠄁

```sh
claude plugin marketplace update textprov-plugins
claude plugin update textprov@textprov-plugins --scope user
```

U󠄁s󠄁e󠄁 t󠄁h󠄁e󠄁 s󠄁c󠄁o󠄁p󠄁e󠄁 w󠄁h󠄁e󠄁r󠄁e󠄁 t󠄁h󠄁e󠄁 p󠄁l󠄁u󠄁g󠄁i󠄁n󠄁 i󠄁s󠄁 i󠄁n󠄁s󠄁t󠄁a󠄁l󠄁l󠄁e󠄁d󠄁;󠄁 t󠄁h󠄁e󠄁 e󠄁x󠄁a󠄁m󠄁p󠄁l󠄁e󠄁 u󠄁p󠄁d󠄁a󠄁t󠄁e󠄁s󠄁 a󠄁 u󠄁s󠄁e󠄁r󠄁 i󠄁n󠄁s󠄁t󠄁a󠄁l󠄁l󠄁a󠄁t󠄁i󠄁o󠄁n󠄁.󠄁
I󠄁f󠄁 t󠄁h󠄁e󠄁 m󠄁a󠄁r󠄁k󠄁e󠄁t󠄁p󠄁l󠄁a󠄁c󠄁e󠄁 i󠄁s󠄁 a󠄁 c󠄁o󠄁p󠄁i󠄁e󠄁d󠄁 l󠄁o󠄁c󠄁a󠄁l󠄁 d󠄁i󠄁r󠄁e󠄁c󠄁t󠄁o󠄁r󠄁y󠄁,󠄁 r󠄁e󠄁f󠄁r󠄁e󠄁s󠄁h󠄁 i󠄁t󠄁s󠄁 s󠄁o󠄁u󠄁r󠄁c󠄁e󠄁 f󠄁i󠄁r󠄁s󠄁t󠄁 u󠄁s󠄁i󠄁n󠄁g󠄁 t󠄁h󠄁e󠄁
[n󠄁e󠄁x󠄁t󠄁 p󠄁r󠄁o󠄁c󠄁e󠄁d󠄁u󠄁r󠄁e󠄁](#refresh-a-copied-local-marketplace).󠄁 A󠄁 m󠄁a󠄁r󠄁k󠄁e󠄁t󠄁p󠄁l󠄁a󠄁c󠄁e󠄁 u󠄁p󠄁d󠄁a󠄁t󠄁e󠄁 c󠄁a󠄁n󠄁n󠄁o󠄁t󠄁
f󠄁e󠄁t󠄁c󠄁h󠄁 n󠄁e󠄁w󠄁e󠄁r󠄁 c󠄁o󠄁d󠄁e󠄁 i󠄁n󠄁t󠄁o󠄁 a󠄁 d󠄁i󠄁r󠄁e󠄁c󠄁t󠄁o󠄁r󠄁y󠄁 t󠄁h󠄁a󠄁t󠄁 s󠄁t󠄁i󠄁l󠄁l󠄁 c󠄁o󠄁n󠄁t󠄁a󠄁i󠄁n󠄁s󠄁 a󠄁n󠄁 o󠄁l󠄁d󠄁e󠄁r󠄁 p󠄁l󠄁u󠄁g󠄁i󠄁n󠄁 s󠄁n󠄁a󠄁p󠄁s󠄁h󠄁o󠄁t󠄁.󠄁

### Refresh a copied local marketplace

U󠄁s󠄁e󠄁 t󠄁h󠄁e󠄁 c󠄁h󠄁e󠄁c󠄁k󠄁o󠄁u󠄁t󠄁 t󠄁h󠄁a󠄁t󠄁 c󠄁o󠄁n󠄁t󠄁a󠄁i󠄁n󠄁s󠄁 t󠄁h󠄁e󠄁 n󠄁e󠄁w󠄁 c󠄁o󠄁m󠄁m󠄁a󠄁n󠄁d󠄁s󠄁 a󠄁n󠄁d󠄁 i󠄁t󠄁s󠄁 m󠄁a󠄁t󠄁c󠄁h󠄁i󠄁n󠄁g󠄁 c󠄁o󠄁r󠄁e󠄁 c󠄁h󠄁e󠄁c󠄁k󠄁o󠄁u󠄁t󠄁.󠄁
R󠄁e󠄁p󠄁l󠄁a󠄁c󠄁e󠄁 t󠄁h󠄁e󠄁 f󠄁i󠄁r󠄁s󠄁t󠄁 t󠄁w󠄁o󠄁 p󠄁a󠄁t󠄁h󠄁s󠄁 b󠄁e󠄁l󠄁o󠄁w󠄁.󠄁 T󠄁h󠄁i󠄁s󠄁 e󠄁x󠄁a󠄁m󠄁p󠄁l󠄁e󠄁 u󠄁s󠄁e󠄁s󠄁 t󠄁h󠄁e󠄁 l󠄁o󠄁c󠄁a󠄁l󠄁 m󠄁a󠄁r󠄁k󠄁e󠄁t󠄁p󠄁l󠄁a󠄁c󠄁e󠄁 a󠄁t󠄁
`~/.local/share/textprov-claude/marketplace`;󠄁 i󠄁f󠄁 y󠄁o󠄁u󠄁r󠄁s󠄁 i󠄁s󠄁 e󠄁l󠄁s󠄁e󠄁w󠄁h󠄁e󠄁r󠄁e󠄁,󠄁 u󠄁s󠄁e󠄁 t󠄁h󠄁e󠄁 d󠄁i󠄁r󠄁e󠄁c󠄁t󠄁o󠄁r󠄁y󠄁
r󠄁e󠄁p󠄁o󠄁r󠄁t󠄁e󠄁d󠄁 b󠄁y󠄁 `claude plugin marketplace list`.󠄁

```sh
textprov_plugin_checkout=/absolute/path/to/claude-textprov-plugin
textprov_core_python=/absolute/path/to/textprov/python
textprov_marketplace="$HOME/.local/share/textprov-claude/marketplace"

rsync -a --exclude=.git --exclude=.remember --exclude=node_modules \
  "$textprov_plugin_checkout/" "$textprov_marketplace/"

claude plugin marketplace update textprov-plugins
claude plugin update textprov@textprov-plugins --scope user

python3 -c 'import json, sys; print(json.dumps({"textprov_python": sys.argv[1]}))' \
  "$textprov_core_python" |
  claude plugin configure textprov@textprov-plugins --values-stdin
```

T󠄁h󠄁e󠄁 c󠄁o󠄁r󠄁e󠄁 p󠄁a󠄁t󠄁h󠄁 m󠄁u󠄁s󠄁t󠄁 n󠄁a󠄁m󠄁e󠄁 t󠄁h󠄁e󠄁 `python/` d󠄁i󠄁r󠄁e󠄁c󠄁t󠄁o󠄁r󠄁y󠄁 c󠄁o󠄁n󠄁t󠄁a󠄁i󠄁n󠄁i󠄁n󠄁g󠄁 `textprov/chronicle.py`.󠄁
T󠄁h󠄁e󠄁 c󠄁o󠄁n󠄁f󠄁i󠄁g󠄁u󠄁r󠄁e󠄁 c󠄁o󠄁m󠄁m󠄁a󠄁n󠄁d󠄁 c󠄁h󠄁a󠄁n󠄁g󠄁e󠄁s󠄁 o󠄁n󠄁l󠄁y󠄁 `textprov_python`;󠄁 o󠄁m󠄁i󠄁t󠄁t󠄁e󠄁d󠄁 o󠄁p󠄁t󠄁i󠄁o󠄁n󠄁s󠄁,󠄁 i󠄁n󠄁c󠄁l󠄁u󠄁d󠄁i󠄁n󠄁g󠄁 t󠄁h󠄁e󠄁
i󠄁n󠄁t󠄁e󠄁r󠄁p󠄁r󠄁e󠄁t󠄁e󠄁r󠄁 a󠄁n󠄁d󠄁 C󠄁h󠄁r󠄁o󠄁n󠄁i󠄁c󠄁l󠄁e󠄁 d󠄁a󠄁t󠄁a󠄁 d󠄁i󠄁r󠄁e󠄁c󠄁t󠄁o󠄁r󠄁y󠄁,󠄁 k󠄁e󠄁e󠄁p󠄁 t󠄁h󠄁e󠄁i󠄁r󠄁 c󠄁o󠄁n󠄁f󠄁i󠄁g󠄁u󠄁r󠄁e󠄁d󠄁 v󠄁a󠄁l󠄁u󠄁e󠄁s󠄁.󠄁 C󠄁o󠄁p󠄁y󠄁i󠄁n󠄁g󠄁 t󠄁h󠄁e󠄁
p󠄁l󠄁u󠄁g󠄁i󠄁n󠄁 s󠄁o󠄁u󠄁r󠄁c󠄁e󠄁 d󠄁o󠄁e󠄁s󠄁 n󠄁o󠄁t󠄁 r󠄁e󠄁p󠄁l󠄁a󠄁c󠄁e󠄁 c󠄁a󠄁p󠄁t󠄁u󠄁r󠄁e󠄁 r󠄁e󠄁c󠄁o󠄁r󠄁d󠄁s󠄁 o󠄁r󠄁 r󠄁e󠄁w󠄁r󠄁i󠄁t󠄁e󠄁 e󠄁x󠄁i󠄁s󠄁t󠄁i󠄁n󠄁g󠄁 a󠄁t󠄁t󠄁r󠄁i󠄁b󠄁u󠄁t󠄁i󠄁o󠄁n󠄁.󠄁
T󠄁h󠄁e󠄁s󠄁e󠄁 c󠄁o󠄁m󠄁m󠄁a󠄁n󠄁d󠄁s󠄁 u󠄁p󠄁d󠄁a󠄁t󠄁e󠄁 t󠄁h󠄁e󠄁 l󠄁o󠄁c󠄁a󠄁l󠄁 i󠄁n󠄁s󠄁t󠄁a󠄁l󠄁l󠄁a󠄁t󠄁i󠄁o󠄁n󠄁 w󠄁i󠄁t󠄁h󠄁o󠄁u󠄁t󠄁 p󠄁u󠄁b󠄁l󠄁i󠄁s󠄁h󠄁i󠄁n󠄁g󠄁 e󠄁i󠄁t󠄁h󠄁e󠄁r󠄁 c󠄁h󠄁e󠄁c󠄁k󠄁o󠄁u󠄁t󠄁.󠄁

C󠄁l󠄁a󠄁u󠄁d󠄁e󠄁 C󠄁o󠄁d󠄁e󠄁 d󠄁e󠄁t󠄁e󠄁c󠄁t󠄁s󠄁 u󠄁p󠄁d󠄁a󠄁t󠄁e󠄁s󠄁 b󠄁y󠄁 p󠄁l󠄁u󠄁g󠄁i󠄁n󠄁 v󠄁e󠄁r󠄁s󠄁i󠄁o󠄁n󠄁.󠄁 I󠄁f󠄁 y󠄁o󠄁u󠄁 e󠄁d󠄁i󠄁t󠄁 a󠄁 l󠄁o󠄁c󠄁a󠄁l󠄁 b󠄁u󠄁i󠄁l󠄁d󠄁 w󠄁i󠄁t󠄁h󠄁o󠄁u󠄁t󠄁
c󠄁h󠄁a󠄁n󠄁g󠄁i󠄁n󠄁g󠄁 i󠄁t󠄁s󠄁 m󠄁a󠄁n󠄁i󠄁f󠄁e󠄁s󠄁t󠄁 v󠄁e󠄁r󠄁s󠄁i󠄁o󠄁n󠄁,󠄁 a󠄁n󠄁 u󠄁p󠄁d󠄁a󠄁t󠄁e󠄁 c󠄁a󠄁n󠄁 k󠄁e󠄁e󠄁p󠄁 t󠄁h󠄁e󠄁 c󠄁a󠄁c󠄁h󠄁e󠄁d󠄁 c󠄁o󠄁p󠄁y󠄁.󠄁 F󠄁o󠄁r󠄁 d󠄁e󠄁v󠄁e󠄁l󠄁o󠄁p󠄁m󠄁e󠄁n󠄁t󠄁
w󠄁i󠄁t󠄁h󠄁o󠄁u󠄁t󠄁 t󠄁h󠄁a󠄁t󠄁 c󠄁a󠄁c󠄁h󠄁e󠄁,󠄁 u󠄁s󠄁e󠄁 t󠄁h󠄁e󠄁 [c󠄁h󠄁e󠄁c󠄁k󠄁o󠄁u󠄁t󠄁-󠄁l󠄁o󠄁a󠄁d󠄁i󠄁n󠄁g󠄁 c󠄁o󠄁m󠄁m󠄁a󠄁n󠄁d󠄁](#install) i󠄁n󠄁s󠄁t󠄁e󠄁a󠄁d󠄁.󠄁

### Check the loaded versions and commands

C󠄁h󠄁e󠄁c󠄁k󠄁 `claude plugin list` f󠄁o󠄁r󠄁 t󠄁h󠄁e󠄁 i󠄁n󠄁s󠄁t󠄁a󠄁l󠄁l󠄁e󠄁d󠄁 T󠄁e󠄁x󠄁t󠄁P󠄁r󠄁o󠄁v󠄁 v󠄁e󠄁r󠄁s󠄁i󠄁o󠄁n󠄁,󠄁 t󠄁h󠄁e󠄁n󠄁 r󠄁e󠄁s󠄁t󠄁a󠄁r󠄁t󠄁 C󠄁l󠄁a󠄁u󠄁d󠄁e󠄁
C󠄁o󠄁d󠄁e󠄁 a󠄁n󠄁d󠄁 r󠄁u󠄁n󠄁:󠄁

```text
/textprov status
/textprov prose
```

F󠄁o󠄁r󠄁 t󠄁h󠄁i󠄁s󠄁 d󠄁e󠄁v󠄁e󠄁l󠄁o󠄁p󠄁m󠄁e󠄁n󠄁t󠄁 b󠄁u󠄁i󠄁l󠄁d󠄁,󠄁 e󠄁x󠄁p󠄁e󠄁c󠄁t󠄁 p󠄁l󠄁u󠄁g󠄁i󠄁n󠄁 0󠄁.󠄁1󠄁.󠄁7󠄁 a󠄁n󠄁d󠄁 c󠄁o󠄁r󠄁e󠄁 0󠄁.󠄁3󠄁.󠄁1󠄁 o󠄁r󠄁 n󠄁e󠄁w󠄁e󠄁r󠄁.󠄁
F󠄁o󠄁r󠄁 t󠄁h󠄁e󠄁 a󠄁l󠄁i󠄁g󠄁n󠄁m󠄁e󠄁n󠄁t󠄁 f󠄁i󠄁x󠄁,󠄁 u󠄁s󠄁e󠄁 t󠄁h󠄁e󠄁 p󠄁a󠄁t󠄁c󠄁h󠄁e󠄁d󠄁 c󠄁o󠄁r󠄁e󠄁 c󠄁h󠄁e󠄁c󠄁k󠄁o󠄁u󠄁t󠄁;󠄁 t󠄁h󠄁e󠄁 v󠄁e󠄁r󠄁s󠄁i󠄁o󠄁n󠄁 a󠄁l󠄁o󠄁n󠄁e󠄁 d󠄁o󠄁e󠄁s󠄁 n󠄁o󠄁t󠄁
i󠄁d󠄁e󠄁n󠄁t󠄁i󠄁f󠄁y󠄁 t󠄁h󠄁a󠄁t󠄁 s󠄁o󠄁u󠄁r󠄁c󠄁e󠄁 c󠄁h󠄁a󠄁n󠄁g󠄁e󠄁.󠄁 S󠄁t󠄁a󠄁t󠄁u󠄁s󠄁 r󠄁e󠄁p󠄁o󠄁r󠄁t󠄁s󠄁 t󠄁h󠄁e󠄁 c󠄁o󠄁r󠄁e󠄁 m󠄁o󠄁d󠄁u󠄁l󠄁e󠄁 p󠄁a󠄁t󠄁h󠄁 s󠄁o󠄁 y󠄁o󠄁u󠄁 c󠄁a󠄁n󠄁 c󠄁h󠄁e󠄁c󠄁k󠄁
w󠄁h󠄁i󠄁c󠄁h󠄁 c󠄁h󠄁e󠄁c󠄁k󠄁o󠄁u󠄁t󠄁 o󠄁r󠄁 i󠄁n󠄁s󠄁t󠄁a󠄁l󠄁l󠄁e󠄁d󠄁 p󠄁a󠄁c󠄁k󠄁a󠄁g󠄁e󠄁 i󠄁s󠄁 a󠄁c󠄁t󠄁u󠄁a󠄁l󠄁l󠄁y󠄁 l󠄁o󠄁a󠄁d󠄁e󠄁d󠄁.󠄁 I󠄁f󠄁 t󠄁h󠄁e󠄁 c󠄁o󠄁m󠄁m󠄁a󠄁n󠄁d󠄁 i󠄁s󠄁 s󠄁t󠄁i󠄁l󠄁l󠄁
u󠄁n󠄁k󠄁n󠄁o󠄁w󠄁n󠄁,󠄁 c󠄁h󠄁e󠄁c󠄁k󠄁 t󠄁h󠄁e󠄁 i󠄁n󠄁s󠄁t󠄁a󠄁l󠄁l󠄁e󠄁d󠄁 v󠄁e󠄁r󠄁s󠄁i󠄁o󠄁n󠄁 a󠄁n󠄁d󠄁 l󠄁o󠄁c󠄁a󠄁l󠄁 m󠄁a󠄁r󠄁k󠄁e󠄁t󠄁p󠄁l󠄁a󠄁c󠄁e󠄁 c󠄁o󠄁n󠄁t󠄁e󠄁n󠄁t󠄁s󠄁 b󠄁e󠄁f󠄁o󠄁r󠄁e󠄁
r󠄁e󠄁s󠄁t󠄁a󠄁r󠄁t󠄁i󠄁n󠄁g󠄁 a󠄁g󠄁a󠄁i󠄁n󠄁.󠄁

## Setup

The plugin requires TextProv Python core 0󠄁.󠄁3󠄁.󠄁1󠄁 or newer with the public chronicle
APIs for status, sessions, attributes, comparison, claim transfer and e󠄁x󠄁p󠄁o󠄁r󠄁t󠄁,󠄁 p󠄁l󠄁u󠄁s󠄁
t󠄁h󠄁e󠄁 l󠄁o󠄁c󠄁a󠄁l󠄁 a󠄁u󠄁t󠄁o󠄁m󠄁a󠄁t󠄁i󠄁c󠄁 m󠄁a󠄁r󠄁k󠄁i󠄁n󠄁g󠄁 a󠄁n󠄁d󠄁 m󠄁a󠄁r󠄁k󠄁e󠄁r󠄁-󠄁a󠄁w󠄁a󠄁r󠄁e󠄁 d󠄁o󠄁c󠄁u󠄁m󠄁e󠄁n󠄁t󠄁 e󠄁d󠄁i󠄁t󠄁i󠄁n󠄁g󠄁 A󠄁P󠄁I󠄁s󠄁.󠄁
This development version is local; point `textprov_python` at the matching core
checkout, or use a locally installed compatible core. Status reports the loaded
module and version and explains an incompatible core. When the plugin is enabled
Claude Code asks for these options; they are also rows in `/config`:

| Option | Meaning |
| --- | --- |
| `textprov_python` | The `python/` directory of a textprov checkout, the one that holds `textprov/chronicle.py`. Leave empty to use an installed `textprov` package. |
| `python` | Interpreter that runs the bridge. Default `python3`, needs 3.9 or newer; the core uses only the standard library. |
| `data_dir` | Where per-project chronicle databases live. Default `~/.claude/plugins/data/textprov`. |
| `chat_marks` | D󠄁e󠄁f󠄁a󠄁u󠄁l󠄁t󠄁 m󠄁o󠄁d󠄁e󠄁:󠄁 `prose` (󠄁d󠄁o󠄁c󠄁u󠄁m󠄁e󠄁n󠄁t󠄁s󠄁 o󠄁n󠄁l󠄁y󠄁)󠄁,󠄁 `all`,󠄁 `none`,󠄁 o󠄁r󠄁 `remove`;󠄁 l󠄁e󠄁g󠄁a󠄁c󠄁y󠄁 `off` a󠄁l󠄁i󠄁a󠄁s󠄁e󠄁s󠄁 `none`.󠄁 |

Run `/textprov status` once: it reports the interpreter, whether the core and its
`chronicle` module were found, and the database path for this project.

Each project root gets its own SQLite database under
`<data_dir>/chronicles/<digest of the real root path>/chronicle.sqlite`, with a `root.txt`
beside it naming the root. Every chronicle call opens and closes the database in a
separate Python process, so separate hook processes and parallel tool calls share it
transactionally. Each process establishes a cryptographic UUID capture namespace,
retained across hot reloads. Prompt keys are `prompt:<namespace>:N`, and retries keep
the exact key and payload. Separate processes resuming the same native session cannot
collapse identical prompts or collide on different prompts just because their counters
start at the same value. If a namespace cannot be established, the plugin reports the
capture failure and leaves the prompt uncaptured; it does not invent a reused key.

At session start the plugin i󠄁n󠄁i󠄁t󠄁i󠄁a󠄁l󠄁i󠄁z󠄁e󠄁s󠄁 i󠄁t󠄁s󠄁 p󠄁e󠄁r󠄁s󠄁i󠄁s󠄁t󠄁e󠄁n󠄁t󠄁 s󠄁t󠄁a󠄁t󠄁u󠄁s󠄁 c󠄁o󠄁u󠄁n󠄁t󠄁 a󠄁n󠄁d󠄁 r󠄁e󠄁a󠄁d󠄁s󠄁 t󠄁h󠄁e󠄁
session's last `capture_sequence` from the
database (`status` and this query never create it) for best-effort count continuity.
This is a snapshot, not an atomic allocator: sequences are process-local observation
metadata, can overlap across simultaneous writers, and imply no global causal order.
Status reports the process's `capture_namespace` separately from its native session ID.

## What it records

| Event | Observation | Correlation |
| --- | --- | --- |
| A non-command prompt delivered through `prompt.submit` without `isMeta` | `submission`, channel `user`, visibility `stored`, the text as it entered the session | `prompt` (its own key, `prompt:<namespace>:N`); `submitted_during` names the turn running when it was submitted |
| A block you pasted into a prompt | `pasted_block`, channel `user`, visibility `stored`: the block exactly as the host delivered it inside its `<pasted_content>` wrapper | `prompt` (the submission's key) and `paste` (the wrapper's id) |
| `Write` or `Edit` tool input | `tool_call`, channel `assistant`, visibility `model`: the written content or the new string | `tool_call` (the tool_use id), `path`, and the running `turn` |
| An `Edit`'s `old_string` | `tool_anchor`, channel `assistant`, visibility `model`: the text the assistant quoted from the file to place the edit | the same `tool_call`, `path` and `turn` |
| The tool's result | `tool_result`, channel `tool`; visibility `model` when the engine relays the model-facing text, `structured` when only the record is available; a denied call is recorded as `unobserved` | the same `tool_call` ID |
| The task given to a subagent | `agent_task`, channel `assistant`, visibility `model`: the Agent call's prompt, recorded in the parent's loop | `agent` (the started agent's id), `tool_call` (the Agent call) and the parent's running `turn` |
| The turn's final answer | `assistant_message`, channel `assistant`, visibility `display`; `partial` when the turn was aborted | `turn` ID, the `prompt` of the submission that started the turn, and `agent` for subagent turns |

A prompt typed while the session is idle has no turn ID when it is submitted. The
main-loop turn that starts with its text claims it: the answer and the tool calls made
during that turn carry that `turn` ID, and the answer also carries the prompt's `prompt`
key, so `inspect` on either side shows the other. The final number in `prompt:<namespace>:N` is
that process's `capture_sequence`; the namespace provides event identity.

A prompt typed while a turn is running is queued by the host, which may deliver it into
that turn, start the next turn with it, or never deliver it (you can pull it back). The
plugin sees it at queueing and cannot tell which, so the submission never carries that
turn as its `turn`; it carries it as `submitted_during`, a fact about timing only. If
the host starts the next turn with the prompt's text, the answer joins it as usual.

Every capture in a subagent's loop (its Write and Edit calls, results and answer) sits
in the agent's own scope and carries the agent id as `agent`. The `agent_task` row in
the parent's scope carries the same id. `inspect <id> --cross-agent` shows these
joins within the same provider and session. Inspection defaults to one agent's scope.

The plugin excludes slash commands and prompts the host marks `isMeta: true`. Other
non-command `prompt.submit` deliveries are captured as submissions, including task
notifications when the host delivers them without that flag. `submission` and
channel `user` describe the transport; they do not establish that a person typed or
authored the text. Text such as `<task-notification>` can also be pasted by a person
and is preserved without inferring its source or a voice.

Claude Code 2.1.310's generated function-hook declarations expose an engine-stamped
`origin.kind`, including `composer` and `task-notification`. Submissions and their
pasted blocks record that value in `attributes.prompt_origin`, or `null` when the
host supplies no origin. Capture does not filter by origin. The separate settings-hook
`UserPromptSubmit` event declares an optional `source`; it is not a field of this
module's `prompt.submit` input. Origin is a host classification, separate from attribution.
The completed 2026-10-23 local trial used plugin 0.1.2 at commit
`70b7579d81034cee2458fd9d789847edf3d0285e` with Claude Code 2.1.310. It verified native
notification text in the chronicle but did not instrument the function-hook origin
of those deliveries. The new origin metadata needs a separate trial of 0.1.3.

Other tools (Bash, MultiEdit, NotebookEdit, MCP tools) are not observed yet; the gap
is deliberate and visible, not filled by guessing. Each Edit capture records
`attributes.replace_all` (false when omitted by the host). It records the requested
operation, not a count of actual replacements. An aborted turn that produced no text
leaves no answer row.

Raw text goes into the core's bounded cache (1 MiB, one hour by default, a policy the
first opener of a database sets). Metadata, ID joins and claims persist. An observation
whose text has expired still inspects; it just cannot be matched or newly claimed.
`inspect` reports `content_expires_at`, so you can see how long a claim stays possible.

The status line shows `N observed`, then `N failed` and `N to retry` when there are
any; the host labels the line with the plugin's name. Claude Code 2.1.310 also renders
a warning glyph on this line when failures and retries are zero. The plugin sends
only the count text through `ui.status`; that API exposes no severity or glyph
option. Use the explicit `failed` and `to retry` counts, or `/textprov status`'s
`failures` and `to_retry`, to assess capture problems. A failure (bridge not found, core
missing, a core refusal) is listed by `/textprov`, kept in the plugin's store for the
s󠄁e󠄁s󠄁s󠄁i󠄁o󠄁n󠄁.󠄁 C󠄁a󠄁p󠄁t󠄁u󠄁r󠄁e󠄁 f󠄁a󠄁i󠄁l󠄁u󠄁r󠄁e󠄁s󠄁 n󠄁e󠄁v󠄁e󠄁r󠄁 b󠄁l󠄁o󠄁c󠄁k󠄁 p󠄁r󠄁o󠄁m󠄁p󠄁t󠄁s󠄁 o󠄁r󠄁 t󠄁o󠄁o󠄁l󠄁s󠄁.󠄁 P󠄁r󠄁o󠄁s󠄁e󠄁 m󠄁a󠄁r󠄁k󠄁i󠄁n󠄁g󠄁 f󠄁a󠄁i󠄁l󠄁u󠄁r󠄁e󠄁s󠄁
r󠄁e󠄁f󠄁u󠄁s󠄁e󠄁 t󠄁h󠄁e󠄁 a󠄁f󠄁f󠄁e󠄁c󠄁t󠄁e󠄁d󠄁 W󠄁r󠄁i󠄁t󠄁e󠄁/󠄁E󠄁d󠄁i󠄁t󠄁 s󠄁o󠄁 u󠄁n󠄁m󠄁a󠄁r󠄁k󠄁e󠄁d󠄁 c󠄁h󠄁a󠄁n󠄁g󠄁e󠄁s󠄁 c󠄁a󠄁n󠄁n󠄁o󠄁t󠄁 s󠄁i󠄁l󠄁e󠄁n󠄁t󠄁l󠄁y󠄁 r󠄁e󠄁p󠄁l󠄁a󠄁c󠄁e󠄁 m󠄁a󠄁r󠄁k󠄁e󠄁d󠄁 t󠄁e󠄁x󠄁t󠄁.󠄁
When the person interrupts a turn
(a "No" at a permission prompt does this), the host kills the bridge process of any
capture still running; that capture keeps its sequence number and is written at the
next event, or half a second later, whichever comes first. The chronicle treats a
repeated key with the same payload as the same event, so a retry never duplicates.

## Commands

```text
/textprov                      list what this process captured, and how many rows
                               the chronicle holds for the session
/textprov list --session [--cross-agent] [--limit N] [--before <id>]
/textprov status               bridge, core and database state, plus the plugin's own:
                               adapter, loaded version, host version, session id,
                               sequence, counts, the last failure, the session's rows
/textprov inspect <id> [--cross-agent]
/textprov match <src> <dst> [--policy exact-v1|line-endings-v1|common-indent-v1]
                           [--partial] [--min-chars N] [--cross-agent]
/textprov claim <id> <start> <end> <voice-id> [definition...]
                [--support <id>] [--cross-agent]
/textprov transfer <JSON>
/textprov resolve <JSON>
/textprov export <JSON>
```

The plugin registers `/textprov`; `status` reports that name as `command`. If a
person or project defines a conflicting command or skill, rename it so the plugin
can use `/textprov`. A registration refusal is listed as a failure; capture continues
without taking over the existing command.

IDs may be unambiguous prefixes of the IDs `/textprov` lists; an observation from
before a resume needs its full ID. `list --session` retrieves full IDs and durable
metadata newest first for the main agent, with `next_before_id` for the next page.
Pass that ID to `--before`; `--limit` accepts 1–1000 (default 100). The response names
the provider, session and agent scope. `--cross-agent` includes that session's
subagents; it still excludes other providers and sessions. `start` and `end` count Unicode scalars from 0, end
excluded, and must sit on grapheme boundaries; the core refuses anything else, and
`inspect` shows `scalar_length`. `voice-id` is a TextProv voice such as `Voice1`;
`Voice0` is unattributed text and needs no claim. The definition says who the voice is:

```text
/textprov claim 5410ad26 0 152 Voice1 the person typing at the prompt
```

A claim is recorded with basis `user_command`, voice context `claude:<session id>` and
the session's adapter string as its policy version. Repeat `--support <id>` to name
supporting observations. Use `--` before definition text containing words beginning
with `--`. Claims still require the person's explicit choice of range and voice.

Matching defaults to `exact-v1` and the entire source block. `line-endings-v1`
compares CRLF/CR as LF; `common-indent-v1` also removes each block's common leading
indentation. `--partial` proposes shared passages of at least `--min-chars` Unicode
scalars (default 16). Comparison views do not rewrite the observations. Returned
ranges and segment mappings refer to the original text; keep discontiguous segments
separate when making claims. Repeated passages remain ambiguous and no candidate is
selected automatically.

Inspect, match and claim support stay within one agent scope by default. Explicit
`--cross-agent` allows other agents in the same provider and session; it does not
allow another session or provider. A match, including a normalized or partial match,
never creates a claim or decides who wrote the passage. Full UUIDs are checked
against the current Claude provider/session; a full ID does not grant access to
another session. A child-agent observation requires explicit cross-agent access.

The three policy commands accept JSON objects of public core arguments. Observation
IDs may use the same prefixes as other commands; claim IDs and content hashes are
copied exactly from inspection. They return JSON and do not write project files.

`transfer` records the person's explicit acceptance of one match candidate and a
nonempty selection of existing source claims. Supply the same comparison options
used for `match`, the zero-based `candidate_index`, exact source/target hashes and
source claim IDs. Even a single candidate needs an explicit index. Cross-agent
transfer requires `"cross_agent": true` and stays within the current provider/session.
The JSON `resolve` and `export` commands also accept `"cross_agent": true` as an
access option for a child-agent observation in this session; the adapter consumes
that option before calling their core APIs.

```text
/textprov transfer {"source_id":"<source UUID>","target_id":"<target UUID>","candidate_index":0,"source_claim_ids":["<claim ID>"],"source_hash":"<hash>","target_hash":"<hash>","comparison_policy":"exact-v1"}
/textprov resolve {"observation_id":"<target UUID>","content_hash":"<hash>"}
```

The shared `supplied-claims-v1` policy transfers only the selected supplied voices,
leaves unknown gaps unattributed, and refuses incompatible overlapping claims.
Inspection retains the selected passage and supporting claim evidence. `resolve`
shows the resulting partition and gaps without needing retained text. Transfer and
export require retained text; an identical successful transfer remains idempotent
after expiry.

`export` requires the exact hash, an explicit human/AI projection for every resolved
voice and `"allow_lossy": true`. Its only supported profile is experimental
`experimental-vs-classification-v1`: the encoded text loses voice identity/context
and claim evidence. Keep the entire returned companion report with its text;
selector offsets in that report permit exact recovery without removing pre-existing
Unicode selectors. Markdown syntax and code are protected by default; unknown
ranges remain unencoded.

```text
/textprov export {"observation_id":"<target UUID>","content_hash":"<hash>","voice_states":[{"voice_context":"claude:<session>","voice_id":"Voice1","state":"human"}],"allow_lossy":true}
```

## Limits

- Capture ownership: do not enable this plugin together with another TextProv capture
  path (such as settings hooks that record prompts) for the same project; the design
  requires one owner per observation stream.
- Observations are listed from session state; after a restart or resume, `/textprov`
  lists only the new process's captures and says so, beside the session's row count
  from the database. Inspect older observations by full ID. Failures are kept per
  session in the plugin's store, so a resumed process still lists them.
- Matching and claiming need the cached text, which expires with the cache policy (one
  hour by default). A claim on an older observation fails with `content unavailable`.
- A paste is recorded as the host delivered it, wrapper included, and the pasted block
  on its own. Explicit comparison policies handle line endings and common indentation;
  arbitrary rendering changes remain outside those policies.
- Editing the plugin folder while a session runs from it (`--plugin-dir`) reloads the
  module in that session. The adapter string is pinned at the session's first load, so
  records and claims keep one adapter per session; `status` shows the loaded version
  beside it.
- The bridge runs one Python process per observation (roughly 100 ms each) and the
  hooks await it, so each prompt, Write, Edit and turn end pays that cost.
- The prototype does not verify host coverage: a passing test here is not evidence
  that a given Claude Code build delivers every event. Check `claude --debug` for
  skipped hooks.

## Development

Develop in a separate checkout or copy while a trial session uses its frozen plugin
and core builds. Editing a folder passed to `--plugin-dir` can hot-reload it into the
running session. Do not edit either build during a declared trial.

For local checks against a core checkout:

```sh
export TEXTPROV_PYTHON=/path/to/textprov/python
claude plugin validate .                 # manifest, marketplace and hooks module
claude plugin test .                     # tests/register.test.ts against the engine
python3 -m unittest discover -s tests    # the bridge against TEXTPROV_PYTHON
tsc -p .                               # requires generated host declarations
```

The Python tests look for the core at `TEXTPROV_PYTHON` or `../textprov/python` and
skip when neither has `textprov/chronicle.py`. The bridge checks the loaded version
and API before every operation; having a file with that name alone is insufficient.
The bridge uses public Chronicle APIs only and preserves the command's existing
`counts`, `cache_policy`, session counts and ISO 8601 expiry presentation.

Loading the plugin once from this folder (`claude --plugin-dir .`) makes Claude Code
write its type declarations to `.claude-plugin/types/`; after that `tsc -p .`
type-checks the module and tests. That folder is ignored by git.

After the checks pass, start a separate feedback-only trial with the frozen
plugin 0󠄁.󠄁1󠄁.󠄁5󠄁 and compatible core. Run `/textprov status` first and record its output
unchanged, all component versions/commits, database observations, evidence and gaps
in `../trials/YYYY-MMDD-N-<topic>.md` (`N` counts trials on that date). Check:

- Deny a Write; confirm retries finish and the call/result leave no sequence gap.
- Queue and withdraw a prompt; confirm `submitted_during` and no incorrect turn join.
- Run a subagent; inspect joins with and without `--cross-agent`, and confirm another
  provider/session is still refused for matching and claim support.
- Resume after a failure; confirm its history survives and process/session counts differ.
- Try explicit normalized/partial matching, Edit `replace_all`, valid claims and invalid
  scalar/grapheme ranges; confirm matches alone leave claims empty.
- Explicitly select a passage/source claims, resolve gaps/conflicts, and export with
  supplied voice classifications and loss acknowledgement; retain the companion report.
- Observe the status glyph with zero failures and an interrupted partial answer.
- Compare a native task notification's `attributes.prompt_origin` with identical
  notification-shaped text pasted by a person; verify the text and claims stay unchanged.

Engine and bridge tests establish local behavior; the trial establishes what the
installed Claude Code build actually delivers. Keep fixes in a later development
session that starts from the trial report. These local checks do not publish the plugin.

Layout:

```text
.claude-plugin/plugin.json       manifest, userConfig
.claude-plugin/marketplace.json  this repository as a one-plugin marketplace
hooks/hooks.json                 names the hooks module
hooks/register.ts                the hooks: session.start, command.run, prompt.submit, turn.start, tool.call, session.append, agent.spawn, turn.complete
hooks/bridge.ts                  runs scripts/textprov_bridge.py and parses its answer
scripts/textprov_bridge.py       locates the core and the database; forwards one operation
types/index.d.ts                 the $.state contract
tests/                           engine tests (TypeScript) and bridge tests (Python)
```

## License

Apache-2.0, like the TextProv code packages.
