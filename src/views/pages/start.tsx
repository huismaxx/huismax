// Copy: companion/v2/docs/retail/SETUP-PAGE.md. Unreleased sections stay omitted.
export const Start = () => (
  <article class="companion-page">
    <h1>Hello. Let's set up your companion.</h1>
    <p>your companion is a desk companion you talk to. It listens for its name, thinks with the AI you choose, and answers out loud.</p>
    <p><strong>Before you start, you need:</strong></p>
    <ul><li><strong>A Windows PC that stays on.</strong> The PC runs your companion's software. When the PC is off or asleep, your companion can't hear or answer you.</li><li><strong>Wi-Fi</strong> (2.4 GHz) that the PC is on too.</li><li><strong>An AI to talk to</strong> — pick one during setup:<ul><li><strong>Google Gemini, free:</strong> a free API key from Google AI Studio. On Google's free tier, Google may use what you say to improve its products, so don't use it for anything private.</li><li><strong>Ollama, on your PC:</strong> free, no key, answers are generated on your PC. Needs a reasonably fast PC.</li><li><strong>Your own API key</strong> from a supported provider. Your provider's prices apply; we don't add any.</li></ul></li></ul>
    <h2>2. Plug in</h2>
    <p>Connect your companion to your PC with the <strong>USB-C cable from the box</strong>. Use that cable for setup: some cables only charge and can't carry data.</p>
    <h2>3. Follow the app</h2>
    <p>The app finds your companion over the cable, asks for your Wi-Fi, and connects it to your PC securely. Your Wi-Fi password goes over the cable only, never over the air. After that you can move your companion anywhere in Wi-Fi range and power it from any USB charger.</p>
    <h2>4. Choose your AI</h2>
    <p>Pick Gemini, Ollama or your own key, then try it: the app runs a short microphone check and a first question.</p>
    <h2>5. Talk</h2>
    <p>Say <strong>"Hey Muse"</strong>, pause, then ask your question. your companion only listens after it hears its name. Anything else said in the room is ignored and never sent anywhere.</p>
    <h2>Help</h2>
    <ul><li><strong>your companion says it can't reach your PC.</strong> Is the PC on and awake, and is the your companion app running in the tray? Turn off "sleep when plugged in" in Windows power settings.</li><li><strong>Wrong Wi-Fi password.</strong> Plug the cable back in and choose <strong>Reconnect device</strong> in the app.</li><li><strong>It doesn't react to its name.</strong> Say the name clearly, pause, then ask. Check the volume in the app.</li><li><strong>Slow answers with Ollama.</strong> Choose a smaller model in the app.</li><li><strong>"Free limit reached" with Gemini.</strong> Google's free tier has a per-minute limit. Wait a minute.</li><li><strong>Start over.</strong> In the app: Settings → Remove device, then set it up again.</li></ul>
    <h2>Developer edition</h2>
    <p>your companion is yours to hack. You can flash your own firmware at any time. The protocol is documented, so your own firmware can talk to the your companion app too. Have a better idea for it? → <a href="https://huismax.com/ideas">huismax.com/ideas</a>: if we adopt your idea, you get a free device (US only).</p>
    <h2>Privacy, briefly</h2>
    <p>Your voice is turned into text by your companion's software on your PC. Your question goes to the AI you chose. The spoken reply is made by an online voice service (Microsoft Edge text-to-speech), so the reply text is sent to Microsoft to turn it into speech. huismax doesn't receive your conversations, your keys or your Wi-Fi password.</p>
  </article>
);
