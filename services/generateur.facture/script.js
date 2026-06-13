const OLLAMA_URL = 'http://localhost:11434/api/chat';
const MODEL = 'phi3:mini';

let factures = JSON.parse(localStorage.getItem('factures') || '[]');
let factureActuelle = null;

// Numérotation automatique
function genererNumeroFacture() {
  const annee = new Date().getFullYear();
  const count = factures.length + 1;
  return `FAC-${annee}-${String(count).padStart(3, '0')}`;
}

// Infos entreprise — demandées au premier lancement
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
  factures.forEach((f, i) => {
    const item = document.createElement('div');
    item.className = 'historique-item';
    item.textContent = f.titre || 'Facture ' + (i + 1);
    item.onclick = () => afficherFacture(f);
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

function nouvelleFacture() {
  factureActuelle = null;
  document.getElementById('prompt-input').value = '';
  document.getElementById('client-nom').value = '';
  document.getElementById('client-email').value = '';
  document.getElementById('client-adresse').value = '';
  document.getElementById('prestation').value = '';
  document.getElementById('quantite').value = '1';
  document.getElementById('prix-unitaire').value = '';
  document.getElementById('tva').value = '20';
  document.getElementById('delai-paiement').value = '';
  document.getElementById('facture-preview').innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">📄</div>
      <p>Ta facture apparaîtra ici</p>
    </div>`;
  document.getElementById('facture-titre').textContent = 'Nouvelle facture';
}

async function genererFacture() {
  const prompt = document.getElementById('prompt-input').value.trim();
  if (!prompt) { alert('Décris ta facture d\'abord !'); return; }

  afficherLoading(true);

  const systemPrompt = `Tu es un assistant qui génère des données de facture en JSON.
Réponds UNIQUEMENT avec un objet JSON valide, rien d'autre.
Format exact :
{
  "numero": "${genererNumeroFacture()}",
  "date": "${new Date().toLocaleDateString('fr-FR')}",
  "client_nom": "",
  "client_email": "",
  "client_adresse": "",
  "prestations": [
    { "description": "", "quantite": 1, "prix_unitaire": 0 }
  ],
  "tva": 20,
  "delai_paiement": "30 jours",
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

    const factureData = JSON.parse(jsonMatch[0]);
    afficherLoading(false);
    renderFacture(factureData);
    sauvegarderFacture(factureData);

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
  const delai = document.getElementById('delai-paiement').value || '30 jours';

  if (!nom || !prestation || !prix) {
    alert('Remplis au minimum : nom client, prestation et prix.');
    return;
  }

  const factureData = {
    numero: genererNumeroFacture(),
    date: new Date().toLocaleDateString('fr-FR'),
    client_nom: nom,
    client_email: email,
    client_adresse: adresse,
    prestations: [{ description: prestation, quantite, prix_unitaire: prix }],
    tva,
    delai_paiement: delai,
    notes: ''
  };

  renderFacture(factureData);
  sauvegarderFacture(factureData);
}

function renderFacture(f) {
  const ht = f.prestations.reduce((acc, p) => acc + p.quantite * p.prix_unitaire, 0);
  const tvaAmount = ht * (f.tva / 100);
  const ttc = ht + tvaAmount;

  const lignes = f.prestations.map(p => `
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
        <div class="facture-numero">${f.numero}</div>
        <div class="facture-date">Date : ${f.date}</div>
      </div>
      <div style="text-align:right">
        <strong>FactureAI</strong><br>
        <span style="color:#666;font-size:0.85rem">Générée automatiquement</span>
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
        <p><strong>${f.client_nom}</strong><br>${f.client_email}<br>${f.client_adresse}</p>
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
      <div class="ligne"><span>TVA (${f.tva}%)</span><span>${tvaAmount.toFixed(2)} €</span></div>
      <div class="ligne total-final"><span>Total TTC</span><span>${ttc.toFixed(2)} €</span></div>
    </div>

    <div class="facture-footer">
      Paiement sous ${f.delai_paiement} · ${f.notes}<br>
      <small>En cas de retard de paiement, une pénalité de 3 fois le taux d'intérêt légal sera appliquée, ainsi qu'une indemnité forfaitaire de recouvrement de 40€ (Art. L441-10 du Code de commerce).</small>
    </div>
  `;

  document.getElementById('facture-titre').textContent = f.numero;
  factureActuelle = f;
}

function sauvegarderFacture(f) {
  f.titre = f.numero;
  factures.unshift(f);
  localStorage.setItem('factures', JSON.stringify(factures));
  afficherHistorique();
}

function afficherFacture(f) { renderFacture(f); }

function telechargerFacture() {
  if (!factureActuelle) { alert('Génère une facture d\'abord !'); return; }

  const contenu = document.getElementById('facture-preview').innerHTML;
  const fenetre = window.open('', '_blank');
  fenetre.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Facture ${factureActuelle.numero}</title>
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

