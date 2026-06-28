// Rule texts (draft — finalized after the test phase) and rendering.

const RULES_ACCEPTED_KEY = 'rsh_rules_accepted_v1';

export const RULE_SECTIONS = [
  {
    titel: '🧭 Geocaching-Regeln',
    punkte: [
      'Suche den Cache vorsichtig und unauffällig – andere müssen ihn auch noch finden können.',
      'Lege den Cache (die Dose) genau dort wieder zurück, wo du ihn gefunden hast, und verstecke ihn wieder gut.',
      'Nimm nichts aus der Dose heraus und lass den Zettel mit dem Codewort drin.',
      'Trage deinen Fund in der App ein und mach ein Foto als Erinnerung.',
      'Hab Geduld – manchmal ist ein Cache gut versteckt. Aufgeben gilt nicht gleich!'
    ]
  },
  {
    titel: '⚠️ Sicherheit',
    punkte: [
      'Achte auf den Verkehr! Schau beim Gehen nicht nur aufs Handy.',
      'Bleibt als Gruppe zusammen und entfernt euch nicht vom vereinbarten Gebiet.',
      'Klettere nicht auf gefährliche Stellen (Mauern, Bäume, ans Wasser) – kein Cache ist ein Risiko wert.',
      'Bei Problemen oder wenn ihr euch verlaufen habt: Ruft eure Lehrerin oder euren Lehrer an.',
      'Achte auf das Wetter und zieh dich passend an.'
    ]
  },
  {
    titel: '🌳 Umwelt',
    punkte: [
      'Hinterlasse die Natur so, wie du sie vorgefunden hast – nimm deinen Müll wieder mit.',
      'Bleib möglichst auf den Wegen und zertrample keine Pflanzen.',
      'Stör keine Tiere und respektiere ihren Lebensraum.',
      'Sei rücksichtsvoll zu anderen Menschen, die unterwegs sind.'
    ]
  }
];

export function rulesAccepted() {
  return localStorage.getItem(RULES_ACCEPTED_KEY) === 'true';
}

export function acceptRules() {
  localStorage.setItem(RULES_ACCEPTED_KEY, 'true');
}

export function renderRules(container) {
  container.innerHTML = '';
  const intro = document.createElement('p');
  intro.className = 'hint';
  intro.textContent =
    'Die Karte braucht Internet. Entfernung und Richtung zum Cache funktionieren immer – auch ohne Netz.';
  container.appendChild(intro);

  for (const section of RULE_SECTIONS) {
    const wrap = document.createElement('div');
    wrap.className = 'rules-section';
    const h = document.createElement('h2');
    h.textContent = section.titel;
    wrap.appendChild(h);
    const ul = document.createElement('ul');
    for (const punkt of section.punkte) {
      const li = document.createElement('li');
      li.textContent = punkt;
      ul.appendChild(li);
    }
    wrap.appendChild(ul);
    container.appendChild(wrap);
  }
}
