// Rule texts loaded from data/rules.json (or localStorage override set by teacher admin).

const RULES_ACCEPTED_KEY = 'rsh_rules_accepted_v1';

export async function loadRules(url = 'data/rules.json') {
  const override = localStorage.getItem('rsh_rules_admin');
  if (override) {
    try { return JSON.parse(override); } catch {}
  }
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch {
    return [];
  }
}

export function rulesAccepted() {
  return localStorage.getItem(RULES_ACCEPTED_KEY) === 'true';
}

export function acceptRules() {
  localStorage.setItem(RULES_ACCEPTED_KEY, 'true');
}

export function renderRules(container, sections) {
  container.innerHTML = '';
  const intro = document.createElement('p');
  intro.className = 'hint';
  intro.textContent =
    'Die Karte braucht Internet. Entfernung und Richtung zum Cache funktionieren immer – auch ohne Netz.';
  container.appendChild(intro);

  for (const section of sections) {
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
