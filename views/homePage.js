function renderHomePage() {
  return `
    <!DOCTYPE html>
    <html lang="sv">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>ShipOne Tracking</title>
      <meta
        name="description"
        content="Sök efter ditt trackingnummer och följ din försändelse med ShipOne."
      />
      <style>
        :root {
          --bg: #f4f7fb;
          --card: #ffffff;
          --text: #14213d;
          --muted: #64748b;
          --line: #e5e7eb;
          --brand: #2563eb;
          --brand-dark: #1d4ed8;
          --soft: #eef4ff;
          --shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
          --danger: #b91c1c;
          --danger-soft: #fef2f2;
          --danger-line: #fecaca;
        }

        * {
          box-sizing: border-box;
        }

        html, body {
          margin: 0;
          padding: 0;
          background: linear-gradient(180deg, #f7f9fd 0%, #f2f5fa 100%);
          color: var(--text);
          font-family: Arial, sans-serif;
        }

        body {
          min-height: 100vh;
        }

        .page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 16px;
        }

        .shell {
          width: 100%;
          max-width: 1080px;
        }

        .card {
          background: var(--card);
          border-radius: 28px;
          box-shadow: var(--shadow);
          overflow: hidden;
          border: 1px solid #edf2f7;
        }

        .hero {
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: 24px;
          padding: 36px;
          background:
            radial-gradient(circle at top right, rgba(37, 99, 235, 0.10), transparent 36%),
            linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
        }

        .eyebrow {
          color: var(--brand);
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 1.6px;
          text-transform: uppercase;
          margin-bottom: 14px;
        }

        h1 {
          margin: 0 0 14px;
          font-size: 52px;
          line-height: 1.02;
          letter-spacing: -0.02em;
        }

        .lead {
          margin: 0;
          color: var(--muted);
          font-size: 19px;
          line-height: 1.7;
          max-width: 640px;
        }

        .info-panel {
          background: #f8fbff;
          border: 1px solid var(--line);
          border-radius: 22px;
          padding: 22px;
          align-self: start;
        }

        .info-title {
          margin: 0 0 14px;
          font-size: 13px;
          color: var(--muted);
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .info-list {
          display: grid;
          gap: 14px;
        }

        .info-item {
          display: grid;
          gap: 4px;
        }

        .info-item strong {
          font-size: 16px;
        }

        .info-item span {
          color: var(--muted);
          font-size: 14px;
          line-height: 1.55;
        }

        .search-section {
          border-top: 1px solid var(--line);
          padding: 28px 36px 36px;
        }

        .search-card {
          background: #f8fafc;
          border: 1px solid #e9eef5;
          border-radius: 22px;
          padding: 24px;
        }

        .search-title {
          margin: 0 0 10px;
          font-size: 26px;
          line-height: 1.2;
        }

        .search-copy {
          margin: 0 0 20px;
          color: var(--muted);
          font-size: 16px;
          line-height: 1.7;
        }

        .search-form {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 14px;
          align-items: start;
        }

        .input-wrap {
          display: grid;
          gap: 10px;
        }

        .tracking-input {
          width: 100%;
          min-height: 58px;
          border-radius: 16px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          padding: 0 18px;
          font-size: 17px;
          font-weight: 600;
          color: var(--text);
          outline: none;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .tracking-input:focus {
          border-color: var(--brand);
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.10);
        }

        .hint {
          color: var(--muted);
          font-size: 14px;
          line-height: 1.6;
        }

        .button {
          min-height: 58px;
          border: none;
          border-radius: 16px;
          background: var(--brand);
          color: #ffffff;
          font-size: 16px;
          font-weight: 800;
          padding: 0 22px;
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .button:hover {
          background: var(--brand-dark);
        }

        .error-box {
          display: none;
          margin-top: 16px;
          background: var(--danger-soft);
          border: 1px solid var(--danger-line);
          color: var(--danger);
          border-radius: 14px;
          padding: 14px 16px;
          font-size: 14px;
          font-weight: 700;
        }

        .footer {
          margin-top: 18px;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.7;
        }

        @media (max-width: 900px) {
          .hero {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .page {
            padding: 12px;
          }

          .hero,
          .search-section {
            padding-left: 20px;
            padding-right: 20px;
          }

          h1 {
            font-size: 38px;
          }

          .lead {
            font-size: 17px;
          }

          .search-form {
            grid-template-columns: 1fr;
          }

          .button {
            width: 100%;
          }
        }
      </style>
    </head>
    <body>
      <main class="page">
        <div class="shell">
          <div class="card">
            <section class="hero">
              <div>
                <div class="eyebrow">ShipOne</div>
                <h1>Spåra ditt paket</h1>
                <p class="lead">
                  Ange ditt trackingnummer för att se aktuell leveransstatus,
                  transportör och shipment-information i ShipOne.
                </p>
              </div>

              <aside class="info-panel">
                <h2 class="info-title">Så fungerar det</h2>

                <div class="info-list">
                  <div class="info-item">
                    <strong>1. Ange trackingnummer</strong>
                    <span>Skriv in trackingnumret du har fått för din försändelse.</span>
                  </div>

                  <div class="info-item">
                    <strong>2. Öppna tracking-sidan</strong>
                    <span>Du skickas vidare till rätt tracking-sida i ShipOne.</span>
                  </div>

                  <div class="info-item">
                    <strong>3. Se aktuell status</strong>
                    <span>Följ order, transportör, status och spårningslänk på ett ställe.</span>
                  </div>
                </div>
              </aside>
            </section>

            <section class="search-section">
              <div class="search-card">
                <h2 class="search-title">Sök trackingnummer</h2>
                <p class="search-copy">
                  Fyll i trackingnumret exakt som du har fått det. Du kan använda både siffror och bokstäver.
                </p>

                <form id="tracking-form" class="search-form">
                  <div class="input-wrap">
                    <input
                      id="tracking-number"
                      class="tracking-input"
                      type="text"
                      name="trackingNumber"
                      placeholder="Till exempel 00573132901419994461"
                      autocomplete="off"
                      spellcheck="false"
                    />
                    <div class="hint">
                      Exempel: 00573132901419994461
                    </div>
                  </div>

                  <button type="submit" class="button">Spåra paket</button>
                </form>

                <div id="form-error" class="error-box">
                  Ange ett trackingnummer innan du fortsätter.
                </div>

                <div class="footer">
                  ShipOne tracking är byggt för tydlig spårning och fungerar nu med PostNord-flödet.
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      <script>
        (function () {
          const form = document.getElementById("tracking-form");
          const input = document.getElementById("tracking-number");
          const errorBox = document.getElementById("form-error");

          function showError(message) {
            errorBox.textContent = message;
            errorBox.style.display = "block";
          }

          function hideError() {
            errorBox.style.display = "none";
          }

          form.addEventListener("submit", function (event) {
            event.preventDefault();

            const rawValue = input.value || "";
            const trackingNumber = rawValue.trim();

            if (!trackingNumber) {
              showError("Ange ett trackingnummer innan du fortsätter.");
              input.focus();
              return;
            }

            hideError();
            window.location.href = "/track/" + encodeURIComponent(trackingNumber);
          });

          input.addEventListener("input", function () {
            if ((input.value || "").trim()) {
              hideError();
            }
          });
        })();
      </script>
    </body>
    </html>
  `;
}

module.exports = {
  renderHomePage
};
