function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderFeatureCard({ eyebrow = "", title, text }) {
  return `
    <div class="feature-card">
      ${eyebrow ? `<div class="feature-eyebrow">${escapeHtml(eyebrow)}</div>` : ""}
      <div class="feature-title">${escapeHtml(title)}</div>
      <div class="feature-text">${escapeHtml(text)}</div>
    </div>
  `;
}

function renderStepCard({ step, title, text }) {
  return `
    <div class="step-card">
      <div class="step-badge">${escapeHtml(step)}</div>
      <div class="step-title">${escapeHtml(title)}</div>
      <div class="step-text">${escapeHtml(text)}</div>
    </div>
  `;
}

function renderCompareRow({ label, traditional, shipone }) {
  return `
    <tr>
      <td>${escapeHtml(label)}</td>
      <td>${escapeHtml(traditional)}</td>
      <td>${escapeHtml(shipone)}</td>
    </tr>
  `;
}

function renderLandingPage() {
  return `
    <!DOCTYPE html>
    <html lang="sv">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>ShipOne – Smart fraktval för e-handel</title>
      <meta
        name="description"
        content="ShipOne hjälper e-handlare att automatiskt välja rätt frakt per order baserat på pris, hastighet och regler."
      />
      <style>
        :root {
          --bg: #f4f7fb;
          --bg-soft: #eef4ff;
          --card: rgba(255,255,255,0.96);
          --text: #132238;
          --muted: #66768d;
          --line: #e2eaf5;
          --brand: #2563eb;
          --brand-dark: #1d4ed8;
          --brand-soft: #eff6ff;
          --success-bg: #ecfdf5;
          --success-text: #047857;
          --warning-bg: #fff7ed;
          --warning-text: #b45309;
          --shadow-soft: 0 12px 30px rgba(15, 23, 42, 0.06);
          --shadow-strong: 0 22px 60px rgba(15, 23, 42, 0.10);
          --radius-xl: 30px;
          --radius-lg: 22px;
          --radius-md: 16px;
          --radius-sm: 12px;
        }

        * {
          box-sizing: border-box;
        }

        html, body {
          margin: 0;
          padding: 0;
          font-family: Arial, sans-serif;
          color: var(--text);
          background:
            radial-gradient(circle at top left, #f9fbff 0%, #f4f7fb 40%, #eef3fa 100%);
        }

        body {
          padding: 24px 16px 56px;
        }

        a {
          color: inherit;
        }

        .wrap {
          max-width: 1200px;
          margin: 0 auto;
        }

        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 18px;
          flex-wrap: wrap;
        }

        .brand {
          color: var(--brand);
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 1.8px;
          text-transform: uppercase;
        }

        .nav {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .nav-link {
          text-decoration: none;
          background: rgba(255,255,255,0.92);
          border: 1px solid var(--line);
          border-radius: 999px;
          padding: 10px 14px;
          font-size: 14px;
          font-weight: 700;
          box-shadow: var(--shadow-soft);
        }

        .nav-link.primary {
          background: linear-gradient(180deg, #2d6df6 0%, #2563eb 100%);
          color: #fff;
          border-color: transparent;
        }

        .hero {
          position: relative;
          overflow: hidden;
          background: linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(250,252,255,0.98) 100%);
          border: 1px solid #e9eef7;
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-strong);
          padding: 36px;
          margin-bottom: 22px;
        }

        .hero::before {
          content: "";
          position: absolute;
          right: -80px;
          top: -80px;
          width: 260px;
          height: 260px;
          background: radial-gradient(circle, rgba(37,99,235,0.12) 0%, rgba(37,99,235,0) 70%);
          pointer-events: none;
        }

        .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 999px;
          padding: 10px 14px;
          background: #eef4ff;
          border: 1px solid #dbeafe;
          color: var(--brand-dark);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        h1 {
          margin: 18px 0 14px;
          font-size: 54px;
          line-height: 1.02;
          letter-spacing: -0.03em;
          max-width: 820px;
        }

        .hero-text {
          max-width: 760px;
          font-size: 18px;
          line-height: 1.75;
          color: var(--muted);
          margin: 0 0 22px;
        }

        .hero-cta {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 24px;
        }

        .cta-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          border-radius: 16px;
          padding: 14px 18px;
          font-size: 15px;
          font-weight: 800;
          min-height: 50px;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }

        .cta-button:hover {
          transform: translateY(-1px);
        }

        .cta-primary {
          background: linear-gradient(180deg, #2d6df6 0%, #2563eb 100%);
          color: #fff;
          box-shadow: 0 14px 30px rgba(37, 99, 235, 0.20);
        }

        .cta-secondary {
          background: #fff;
          border: 1px solid #cfe0ff;
          color: var(--brand);
        }

        .hero-points {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .hero-point {
          background: rgba(255,255,255,0.86);
          border: 1px solid var(--line);
          border-radius: 18px;
          padding: 16px;
          box-shadow: var(--shadow-soft);
        }

        .hero-point-title {
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--muted);
          font-weight: 800;
          margin-bottom: 8px;
        }

        .hero-point-text {
          font-size: 15px;
          line-height: 1.65;
        }

        .section {
          margin-bottom: 22px;
          background: var(--card);
          border: 1px solid #e8eef7;
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-strong);
          padding: 28px;
        }

        .section-head {
          max-width: 760px;
          margin-bottom: 20px;
        }

        .section-kicker {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--brand);
          font-weight: 800;
          margin-bottom: 10px;
        }

        .section-title {
          margin: 0 0 10px;
          font-size: 34px;
          line-height: 1.1;
          letter-spacing: -0.02em;
        }

        .section-text {
          margin: 0;
          font-size: 16px;
          line-height: 1.75;
          color: var(--muted);
        }

        .feature-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }

        .feature-card {
          background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
          border: 1px solid var(--line);
          border-radius: 20px;
          padding: 18px;
          box-shadow: var(--shadow-soft);
        }

        .feature-eyebrow {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--brand);
          font-weight: 800;
          margin-bottom: 8px;
        }

        .feature-title {
          font-size: 20px;
          font-weight: 800;
          margin-bottom: 10px;
          line-height: 1.25;
        }

        .feature-text {
          font-size: 15px;
          line-height: 1.7;
          color: var(--muted);
        }

        .steps-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }

        .step-card {
          border: 1px solid var(--line);
          background: #fbfdff;
          border-radius: 20px;
          padding: 18px;
        }

        .step-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 36px;
          height: 36px;
          border-radius: 999px;
          background: #eef4ff;
          color: var(--brand-dark);
          font-size: 13px;
          font-weight: 800;
          margin-bottom: 12px;
        }

        .step-title {
          font-size: 19px;
          font-weight: 800;
          margin-bottom: 10px;
        }

        .step-text {
          font-size: 15px;
          line-height: 1.7;
          color: var(--muted);
        }

        .compare-table-wrap {
          overflow-x: auto;
          border: 1px solid var(--line);
          border-radius: 20px;
          background: #fff;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 760px;
        }

        th, td {
          text-align: left;
          padding: 16px;
          border-bottom: 1px solid #edf2f7;
          vertical-align: top;
        }

        th {
          background: #f8fbff;
          font-size: 12px;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        td {
          font-size: 15px;
          line-height: 1.65;
        }

        tr:last-child td {
          border-bottom: none;
        }

        .highlight-col {
          background: #f8fbff;
        }

        .pilot-box {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 18px;
          align-items: stretch;
        }

        .pilot-panel {
          border: 1px solid var(--line);
          border-radius: 20px;
          background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
          padding: 20px;
        }

        .pilot-panel h3 {
          margin: 0 0 12px;
          font-size: 22px;
        }

        .pilot-panel p {
          margin: 0 0 14px;
          font-size: 15px;
          line-height: 1.75;
          color: var(--muted);
        }

        .pilot-list {
          display: grid;
          gap: 10px;
        }

        .pilot-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 15px;
          line-height: 1.65;
        }

        .pilot-dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: var(--brand);
          margin-top: 8px;
          flex: 0 0 auto;
        }

        .contact-card {
          border: 1px solid #dbeafe;
          background: linear-gradient(180deg, #f8fbff 0%, #eff6ff 100%);
          border-radius: 20px;
          padding: 20px;
        }

        .contact-label {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--brand-dark);
          font-weight: 800;
          margin-bottom: 8px;
        }

        .contact-value {
          font-size: 24px;
          font-weight: 800;
          line-height: 1.2;
          margin-bottom: 12px;
        }

        .contact-text {
          font-size: 15px;
          line-height: 1.75;
          color: var(--muted);
          margin-bottom: 16px;
        }

        .footer {
          margin-top: 10px;
          text-align: center;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.7;
        }

        .footer strong {
          color: var(--text);
        }

        @media (max-width: 1080px) {
          .hero-points,
          .feature-grid,
          .steps-grid,
          .pilot-box {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          body {
            padding: 16px 10px 40px;
          }

          .hero,
          .section {
            padding: 22px;
            border-radius: 22px;
          }

          h1 {
            font-size: 38px;
          }

          .section-title {
            font-size: 28px;
          }

          .hero-text,
          .section-text {
            font-size: 15px;
          }
        }
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="topbar">
          <div class="brand">ShipOne</div>

          <div class="nav">
            <a class="nav-link" href="/admin">Admin</a>
            <a class="nav-link primary" href="mailto:info@shipone.se">Ansök om pilot</a>
          </div>
        </div>

        <section class="hero">
          <div class="eyebrow">Fraktlogik för e-handel</div>

          <h1>ShipOne väljer rätt frakt per order – automatiskt.</h1>

          <p class="hero-text">
            ShipOne hjälper e-handlare att välja rätt carrier utifrån pris, hastighet, regler och fallback – i stället för att alltid köra samma transportör eller fatta beslut manuellt varje gång.
          </p>

          <div class="hero-cta">
            <a class="cta-button cta-primary" href="mailto:info@shipone.se?subject=ShipOne pilot">
              Ansök om pilot
            </a>
            <a class="cta-button cta-secondary" href="/admin">
              Se admin-demo
            </a>
          </div>

          <div class="hero-points">
            <div class="hero-point">
              <div class="hero-point-title">Automatiskt val</div>
              <div class="hero-point-text">
                ShipOne kan prioritera billig, snabb eller mer miljövänlig leverans per order.
              </div>
            </div>

            <div class="hero-point">
              <div class="hero-point-title">Fallback & policy</div>
              <div class="hero-point-text">
                Om ett val inte går att använda fullt ut kan ShipOne växla till fungerande fallback och visa varför.
              </div>
            </div>

            <div class="hero-point">
              <div class="hero-point-title">Tracking på ett ställe</div>
              <div class="hero-point-text">
                Adminen visar shipment health, sync-status, timeline och carrier-status i ett sammanhållet flöde.
              </div>
            </div>
          </div>
        </section>

        <section class="section">
          <div class="section-head">
            <div class="section-kicker">Vad ShipOne gör</div>
            <h2 class="section-title">Mer än bara etiketter och bokning</h2>
            <p class="section-text">
              Många fraktverktyg hjälper dig att boka och skriva ut etiketter. ShipOne fokuserar på lagret ovanpå: beslutet om vilken carrier som faktiskt borde användas för just den ordern.
            </p>
          </div>

          <div class="feature-grid">
            ${renderFeatureCard({
              eyebrow: "Beslutsmotor",
              title: "Automatiskt carrier-val",
              text: "ShipOne hjälper butiken att slippa manuella beslut i de fall där regler inte räcker eller flera val ser liknande ut."
            })}

            ${renderFeatureCard({
              eyebrow: "Kontroll",
              title: "Tydlig fallback-logik",
              text: "Om ursprungsvalet inte fungerar visar ShipOne när fallback användes, vilken carrier som valdes och varför utfallet ändrades."
            })}

            ${renderFeatureCard({
              eyebrow: "Drift",
              title: "Health, sync och tracking",
              text: "ShipOne samlar status, sync och tracking-events i admin så butiken snabbt ser vad som fungerar, väntar eller blockerats."
            })}
          </div>
        </section>

        <section class="section">
          <div class="section-head">
            <div class="section-kicker">Hur det funkar</div>
            <h2 class="section-title">Tre steg från order till leveranslogik</h2>
            <p class="section-text">
              ShipOne är byggt för att kunna börja i pilotläge och bli mer automatiserat över tid. Fokus ligger på att ge tydliga beslut och bättre kontroll per shipment.
            </p>
          </div>

          <div class="steps-grid">
            ${renderStepCard({
              step: "1",
              title: "Ordern kommer in",
              text: "ShipOne tar emot orderdata och läser relevanta signaler som leveransval, destination, merchant-regler och tillgängliga carriers."
            })}

            ${renderStepCard({
              step: "2",
              title: "ShipOne väljer upplägg",
              text: "Systemet väljer billig, snabb, smart eller miljövänlig väg beroende på strategi – och hanterar fallback om det behövs."
            })}

            ${renderStepCard({
              step: "3",
              title: "Admin visar hela utfallet",
              text: "Butiken ser vilken carrier som valdes, vad som faktiskt användes, om tracking blockerats och hur senaste sync ser ut."
            })}
          </div>
        </section>

        <section class="section">
          <div class="section-head">
            <div class="section-kicker">Skillnaden</div>
            <h2 class="section-title">ShipOne jämfört med traditionella fraktflöden</h2>
            <p class="section-text">
              ShipOne ska inte bara vara ännu ett fraktverktyg. Målet är att vara lagret som hjälper butiken fatta rätt beslut per order.
            </p>
          </div>

          <div class="compare-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Område</th>
                  <th>Traditionellt fraktflöde</th>
                  <th class="highlight-col">ShipOne</th>
                </tr>
              </thead>
              <tbody>
                ${renderCompareRow({
                  label: "Carrier-val",
                  traditional: "Butiken väljer själv eller kör samma carrier varje gång",
                  shipone: "ShipOne hjälper till att välja rätt carrier per order"
                })}

                ${renderCompareRow({
                  label: "Regler",
                  traditional: "Statiska regler löser mycket men inte allt",
                  shipone: "ShipOne ska täcka även de fall där regler inte räcker"
                })}

                ${renderCompareRow({
                  label: "Fallback",
                  traditional: "Otydligt när ursprungsvalet inte fungerar",
                  shipone: "Tydligt när fallback används och vad slututfallet blev"
                })}

                ${renderCompareRow({
                  label: "Överblick",
                  traditional: "Status finns utspridd i flera system",
                  shipone: "Admin visar health, sync, tracking och val i samma flöde"
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section class="section">
          <div class="section-head">
            <div class="section-kicker">Pilot</div>
            <h2 class="section-title">ShipOne är öppet för tidiga pilotbutiker</h2>
            <p class="section-text">
              Just nu söker ShipOne några få e-handlare som vill testa flödet i ett tidigt skede. Fokus är att validera routing, tracking och admin tillsammans med riktiga butiker.
            </p>
          </div>

          <div class="pilot-box">
            <div class="pilot-panel">
              <h3>Vad piloten innebär</h3>
              <p>
                Piloten är tänkt att vara enkel, tydlig och låg risk för butiken. Vi börjar hellre manuellt och korrekt än komplext och för tidigt.
              </p>

              <div class="pilot-list">
                <div class="pilot-item">
                  <div class="pilot-dot"></div>
                  <div>ShipOne sätts upp försiktigt med fokus på verkliga orders och verkliga fraktflöden.</div>
                </div>

                <div class="pilot-item">
                  <div class="pilot-dot"></div>
                  <div>Butiken får tydlig insyn i varför ShipOne valde en viss carrier eller varför fallback användes.</div>
                </div>

                <div class="pilot-item">
                  <div class="pilot-dot"></div>
                  <div>Feedback från piloten används för att göra ShipOne mer komplett som SaaS för svenska och nordiska butiker.</div>
                </div>
              </div>
            </div>

            <div class="contact-card">
              <div class="contact-label">Kontakt</div>
              <div class="contact-value">info@shipone.se</div>
              <div class="contact-text">
                Driver du e-handel och vill testa ShipOne i tidigt skede? Hör av dig för pilot, demo eller feedback.
              </div>

              <a class="cta-button cta-primary" href="mailto:info@shipone.se?subject=ShipOne pilot">
                Kontakta ShipOne
              </a>
            </div>
          </div>
        </section>

        <div class="footer">
          <strong>ShipOne</strong> – byggt för att göra fraktlogik enklare för e-handlare.<br />
          Sverige / Nordic pilot · PostNord + DHL-flöden · Admin, tracking och fallback i ett system
        </div>
      </div>
    </body>
    </html>
  `;
}

module.exports = {
  renderLandingPage
};
