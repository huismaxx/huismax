// Copy: companion/v2/docs/retail/SETUP-PAGE.md, {BRAND} = "your companion". Sections marked "(when available)" and the
// editorial notes stay out until they ship.
export const Start = () => (
  <article class="companion-page">
    <h1>Hello. Let's set up your companion.</h1>
    <p>Your companion is a desk companion you talk to. It listens for its name, thinks with the AI you choose, and answers out loud.</p>
    <p><strong>Before you start, you need:</strong></p>
    <ul>
      <li>Your companion needs a Windows PC that stays on. The PC runs your companion's software; when the PC is off or asleep, your companion can't hear or answer you.</li>
      <li>A 2.4 GHz Wi-Fi network that the PC is on too.</li>
      <li>
        <strong>An AI to talk to</strong> — pick one during setup:
        <ul>
          <li><strong>Google Gemini, free:</strong> a free API key from Google AI Studio. On Google's free tier, Google may use what you say to improve its products, so don't use it for anything private.</li>
          <li><strong>Ollama, on your PC:</strong> free, no key, answers are generated on your PC. Needs a reasonably fast PC.</li>
          <li><strong>Your own API key</strong> from a supported provider. Your provider's prices apply; we don't add any.</li>
        </ul>
      </li>
    </ul>
    <h2>2. Plug in</h2>
    <p>Connect your companion to your PC with the <strong>USB-C cable from the box</strong>. Use that cable for setup: some cables only charge and can't carry data.</p>
    <h2>3. Follow the app</h2>
    <p>The app finds your companion over the cable, asks for your Wi-Fi, and connects it to your PC securely. Your Wi-Fi password goes over the cable only, never over the air. After that you can move your companion anywhere in Wi-Fi range and power it from any USB charger.</p>
    <h2>4. Choose your AI</h2>
    <p>You bring the AI. Use a free Google Gemini key, a model running on your own PC with Ollama, or your own API key from a supported provider. Your provider's terms and charges apply; we don't add any.</p>
    <p>Pick Gemini, Ollama or your own key, then try it: the app runs a short microphone check and a first question.</p>
    <h2>5. Talk</h2>
    <p>Start the voice check when ready. Follow the verified tap instructions shown for your device, wait for <strong>Listening</strong>, then ask "What is two plus two?" Stop speaking and wait. Confirm <strong>I heard the answer</strong> only after hearing the selected AI's answer. If nothing is heard, choose <strong>No audio</strong>; setup stays incomplete.</p>
    <h2>Help</h2>
    <p>Open <strong>Help → First answer</strong>.</p>
    <ul>
      <li><strong>Network not connected.</strong> Open <strong>Network setup</strong>, choose a supported network and re-enter a rejected password privately. Preserve working configuration.</li>
      <li><strong>Connect this device first.</strong> Open <strong>Device connection</strong>, verify the device and trusted This PC service, then reconnect with the USB-C data cable from the box. Do not enter a pairing code or reset after an uncertain request.</li>
      <li><strong>Companion service not found.</strong> Check the app/service is running, the PC is awake and both devices use the same supported network. Choose <strong>Retry discovery</strong>. A trust mismatch requires help.</li>
      <li><strong>Use tap to start.</strong> Follow the verified device tap instructions and wait for <strong>Listening</strong> before speaking.</li>
      <li><strong>Could not confirm audio playback.</strong> Check volume using the verified device control, then explicitly run the audio check. Retry one short phrase after Listening if speech was not recognized; if text arrived without sound, open <strong>No audio</strong> help.</li>
      <li><strong>Selected brain unavailable.</strong> Open <strong>Brain setup</strong>, check selected service status and explicitly retry after recovery. Preserve configuration; a TLS failure requires help. An uncertain request is not automatically resent or sent to another AI.</li>
      <li><strong>Usage limit reached.</strong> Check the provider plan and wait until its retry/reset time if provided, then explicitly retry. Do not assume a fixed reset time.</li>
      <li><strong>Slow answers with Ollama.</strong> Try a smaller installed model. Install Ollama and download a model before selecting it; no silent downloads.</li>
    </ul>
    <p>Reopen the app to continue; check the connection, then explicitly start again. Share error category and build versions only; do not share passwords, pairing codes, keys or recordings.</p>
    <h2>Developer edition</h2>
    <p>Your companion is yours to hack. You can flash your own firmware at any time.</p>
    <p>Have an idea? Visit <a href="https://huismax.com/ideas">huismax.com/ideas</a>: adopted ideas receive a free device under its published rules (US only).</p>
    <h2>Privacy, briefly</h2>
    <p>Spoken replies use an online voice service (Microsoft Edge text-to-speech), so the reply text is sent to Microsoft to be spoken. Your speech is recognized on your PC.</p>
    <p>Your question goes to the AI you choose. On Google's free tier, Google may use your prompts and replies to improve its products, and people may review them. Don't use the free tier for anything private. Upgrade the key to a paid Google plan to change this. Ollama generates answers on your PC; the default online voice still sends reply text to Microsoft.</p>
  </article>
);
