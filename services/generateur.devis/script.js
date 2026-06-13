const OLLAMA_URL = 'http://localhost:11434/api/chat';
const MODEL = 'phi3:mini';

let devis = JSON.parse(localStorage.getItem('devis') || '[]');
let devisActuel = null;

// Numérotation automatique
function genererNumeroDevis() {
  const annee = new Date().getFullYear();
  const count = devis.length + 1;
  return `DEV-${annee}-${String(count).padStart(3, '0')}`;
}

// Infos entreprise — partagées avec le générateur de factures
let infoEntreprise = JSON.parse(localStorage.getItem('entreprise') || 'null');

if (!infoEntreprise) {
  const nom = prompt('Bienvenue ! Nom de ton entreprise :');
  const adresse = prompt('Adresse :');
  const ville = prompt('Ville et code postal :');
  const siret = prompt('Numéro SIRET (14 chiffres) :');
  infoEntreprise = {
    nom: nom || 'Mon Entreprise',
    adresse: adresse || '',
    ville: ville || '',
    siret: siret || ''
  };
  localStorage.setItem('entreprise', JSON.stringify(infoEntreprise));
}

afficherHistorique();

function afficherHistorique() {
  const list = document.getElementById('historique-list');
  list.innerHTML = '';
  devis.forEach((d, i) => {
    const item = document.createElement('div');
    item.className = 'historique-item';
    item.textContent = d.titre || 'Devis ' + (i + 1);
    item.onclick = () => afficherDevis(d);
    list.appendChild(item);
  });
}

function modifierEntreprise() {
  const nom = prompt('Nom entreprise :', infoEntreprise.nom);
  const adresse = prompt('Adresse :', infoEntreprise.adresse);
  const ville = prompt('Ville :', infoEntreprise.ville);
  const siret = prompt('SIRET :', infoEntreprise.siret);
  infoEntreprise = {
    nom: nom || infoEntreprise.nom,
    adresse: adresse || infoEntreprise.adresse,
    ville: ville || infoEntreprise.ville,
    siret: siret || infoEntreprise.siret
  };
  localStorage.setItem('entreprise', JSON.stringify(infoEntreprise));
  alert('✅ Infos mises à jour !');
}

function nouveauDevis() {
  devisActuel = null;
  document.getElementById('prompt-input').value = '';
  document.getElementById('client-nom').value = '';
  document.getElementById('client-email').value = '';
  document.getElementById('client-adresse').value = '';
  document.getElementById('prestation').value = '';
  document.getElementById('quantite').value = '1';
  document.getElementById('prix-unitaire').value = '';
  document.getElementById('tva').value = '20';
  document.getElementById('validite').value = '';
  document.getElementById('facture-preview').innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">📄</div>
      <p>Ton devis apparaîtra ici</p>
    </div>`;
  document.getElementById('devis-titre').textContent = 'Nouveau devis';
}

async function genererDevis() {
  const prompt = document.getElementById('prompt-input').value.trim();
  if (!prompt) { alert('Décris ton devis d\'abord !'); return; }

  afficherLoading(true);

  const systemPrompt = `Tu es un assistant qui génère des données de devis en JSON.
Réponds UNIQUEMENT avec un objet JSON valide, rien d'autre.
Format exact :
{
  "numero": "${genererNumeroDevis()}",
  "date": "${new Date().toLocaleDateString('fr-FR')}",
  "validite": "30 jours",
  "client_nom": "",
  "client_email": "",
  "client_adresse": "",
  "prestations": [
    { "description": "", "quantite": 1, "prix_unitaire": 0 }
  ],
  "tva": 20,
  "notes": ""
}`;

  try {
    const response = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ]
      })
    });

    const data = await response.json();
    const contenu = data.message.content;
    const jsonMatch = contenu.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON invalide');

    const devisData = JSON.parse(jsonMatch[0]);
    afficherLoading(false);
    renderDevis(devisData);
    sauvegarderDevis(devisData);

  } catch (err) {
    afficherLoading(false);
    alert('Erreur : ' + err.message + '\nVérifie qu\'Ollama tourne bien.');
  }
}

function genererManuel() {
  const nom = document.getElementById('client-nom').value;
  const email = document.getElementById('client-email').value;
  const adresse = document.getElementById('client-adresse').value;
  const prestation = document.getElementById('prestation').value;
  const quantite = parseFloat(document.getElementById('quantite').value) || 1;
  const prix = parseFloat(document.getElementById('prix-unitaire').value) || 0;
  const tva = parseFloat(document.getElementById('tva').value) || 20;
  const validite = document.getElementById('validite').value || '30 jours';

  if (!nom || !prestation || !prix) {
    alert('Remplis au minimum : nom client, prestation et prix.');
    return;
  }

  const devisData = {
    numero: genererNumeroDevis(),
    date: new Date().toLocaleDateString('fr-FR'),
    validite,
    client_nom: nom,
    client_email: email,
    client_adresse: adresse,
    prestations: [{ description: prestation, quantite, prix_unitaire: prix }],
    tva,
    notes: ''
  };

  renderDevis(devisData);
  sauvegarderDevis(devisData);
}

function renderDevis(d) {
  const ht = d.prestations.reduce((acc, p) => acc + p.quantite * p.prix_unitaire, 0);
  const tvaAmount = ht * (d.tva / 100);
  const ttc = ht + tvaAmount;

  const lignes = d.prestations.map(p => `
    <tr>
      <td>${p.description}</td>
      <td>${p.quantite}</td>
      <td>${p.prix_unitaire.toFixed(2)} €</td>
      <td>${(p.quantite * p.prix_unitaire).toFixed(2)} €</td>
    </tr>
  `).join('');

  document.getElementById('facture-preview').innerHTML = `
    <div class="facture-header">
      <div>
        <div class="facture-numero">DEVIS ${d.numero}</div>
        <div class="facture-date">Date : ${d.date}</div>
        <div class="facture-date">Valable jusqu'au : ${getDateValidite(d.date, d.validite)}</div>
      </div>
      <div style="text-align:right">
        <strong>FactureAI</strong><br>
        <span style="color:#666;font-size:0.85rem">Généré automatiquement</span>
      </div>
    </div>

    <div class="facture-parties">
      <div class="facture-partie">
        <h4>Émetteur</h4>
        <p>
          <strong>${infoEntreprise.nom}</strong><br>
          ${infoEntreprise.adresse}<br>
          ${infoEntreprise.ville}<br>
          <span style="color:#666;font-size:0.85rem">SIRET : ${infoEntreprise.siret || 'Non renseigné'}</span>
        </p>
      </div>
      <div class="facture-partie">
        <h4>Client</h4>
        <p><strong>${d.client_nom}</strong><br>${d.client_email}<br>${d.client_adresse}</p>
      </div>
    </div>

    <table class="facture-table">
      <thead>
        <tr>
          <th>Description</th>
          <th>Qté</th>
          <th>Prix unitaire</th>
          <th>Total HT</th>
        </tr>
      </thead>
      <tbody>${lignes}</tbody>
    </table>

    <div class="facture-totaux">
      <div class="ligne"><span>Sous-total HT</span><span>${ht.toFixed(2)} €</span></div>
      <div class="ligne"><span>TVA (${d.tva}%)</span><span>${tvaAmount.toFixed(2)} €</span></div>
      <div class="ligne total-final"><span>Total TTC</span><span>${ttc.toFixed(2)} €</span></div>
    </div>

    <div class="signature-box">
      <div class="signature-bloc">
        <h4>Émetteur</h4>
        <p>Signature et cachet</p>
      </div>
      <div class="signature-bloc">
        <h4>Client — Bon pour accord</h4>
        <p>Date, signature et mention "Bon pour accord"</p>
      </div>
    </div>

    <div class="facture-footer">
      Devis valable ${d.validite} · ${d.notes}<br>
      <small>Ce devis est valable ${d.validite} à compter de sa date d'émission. Passé ce délai, les prix indiqués pourront être révisés. La signature de ce devis vaut acceptation des conditions.</small>
    </div>
  `;

  document.getElementById('devis-titre').textContent = d.numero;
  devisActuel = d;
}

function getDateValidite(dateStr, validite) {
  try {
    const parts = dateStr.split('/');
    const date = new Date(parts[2], parts[1] - 1, parts[0]);
    const jours = parseInt(validite) || 30;
    date.setDate(date.getDate() + jours);
    return date.toLocaleDateString('fr-FR');
  } catch {
    return 'Non défini';
  }
}

function sauvegarderDevis(d) {
  d.titre = d.numero;
  devis.unshift(d);
  localStorage.setItem('devis', JSON.stringify(devis));
  afficherHistorique();
}

function afficherDevis(d) { renderDevis(d); }

function telechargerDevis() {
  if (!devisActuel) { alert('Génère un devis d\'abord !'); return; }

  const contenu = document.getElementById('facture-preview').innerHTML;
  const fenetre = window.open('', '_blank');
  fenetre.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Devis ${devisActuel.numero}</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; padding: 40px; color: #111; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th { background: #f5f5f5; padding: 10px 14px; text-align: left; font-size: 0.8rem; text-transform: uppercase; color: #666; }
        td { padding: 12px 14px; border-bottom: 1px solid #eee; font-size: 0.9rem; }
        .facture-header { display: flex; justify-content: space-between; margin-bottom: 40px; }
        .facture-numero { font-size: 1.4rem; font-weight: 700; }
        .facture-date { color: #666; font-size: 0.9rem; }
        .facture-parties { display: flex; justify-content: space-between; margin-bottom: 40px; }
        .facture-partie h4 { font-size: 0.75rem; text-transform: uppercase; color: #999; margin-bottom: 6px; }
        .facture-partie p { font-size: 0.9rem; line-height: 1.6; }
        .facture-totaux { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
        .ligne { display: flex; gap: 40px; font-size: 0.9rem; }
        .total-final { font-size: 1.1rem; font-weight: 700; border-top: 2px solid #111; padding-top: 8px; margin-top: 4px; }
        .signature-box { margin-top: 40px; display: flex; justify-content: space-between; gap: 40px; }
        .signature-bloc { flex: 1; border: 1px solid #ddd; border-radius: 8px; padding: 16px; min-height: 100px; }
        .signature-bloc h4 { font-size: 0.75rem; text-transform: uppercase; color: #999; margin-bottom: 8px; }
        .signature-bloc p { font-size: 0.8rem; color: #aaa; }
        .facture-footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 0.8rem; color: #999; text-align: center; line-height: 1.6; }
      </style>
    </head>
    <body>${contenu}</body>
    </html>
  `);
  fenetre.document.close();
  fenetre.focus();
  setTimeout(() => { fenetre.print(); fenetre.close(); }, 500);
}

function afficherLoading(show) {
  document.getElementById('loading').classList.toggle('hidden', !show);
}

