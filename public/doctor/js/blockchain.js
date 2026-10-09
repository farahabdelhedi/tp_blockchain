
{
// Configuration du réseau Hardhat Local.
const EXPECTED_CHAIN_ID = 31337n;

// Adresse du contrat redéployé sur le nœud Hardhat actuel.
const CONTRACT_ADDRESS =
  "0x5FbDB2315678afecb367f032d93F642f64180aa3";

// ABI minimale du contrat MedicalRecord existant.
// Nous ne modifions pas le contrat Solidity.
const CONTRACT_ABI = [
  "function storeHash(string patientId, bytes32 hash)",
  "function getLatestHash(string patientId) view returns (bytes32)",
  "function getVersionCount(string patientId) view returns (uint256)",
  "function verifyHash(string patientId, bytes32 hash) view returns (bool)"
];

// Éléments de l'interface.
const connectBtn = document.getElementById("connectWalletBtn");
const loadBtn = document.getElementById("loadBlockchainDataBtn");
const storeBtn = document.getElementById("storeHashBtn");
const verifyBtn = document.getElementById("verifyHashBtn");
const storeHashStatusEl = document.getElementById("storeHashStatus");
const storeHashTransactionEl = document.getElementById("storeHashTransaction");

const statusEl = document.getElementById("blockchainConnectionStatus");
const addressEl = document.getElementById("walletAddress");
const networkEl = document.getElementById("networkName");
const chainIdEl = document.getElementById("chainId");
const patientIdEl = document.getElementById("blockchainPatientId");
const versionCountEl = document.getElementById("versionCount");
const calculatedHashEl = document.getElementById("calculatedHash");
const dossierHashStatusEl = document.getElementById("dossierHashStatus");
const dossierHashCountsEl = document.getElementById("dossierHashCounts");
const canonicalDossierJsonEl = document.getElementById("canonicalDossierJson");
const recalculateHashBtn = document.getElementById("recalculateDossierHashBtn");
const copyHashBtn = document.getElementById("copyDossierHashBtn");
const verifyDossierHashBtn = document.getElementById("verifyDossierHashBtn");
const toggleDossierJsonBtn = document.getElementById("toggleDossierJsonBtn");
const latestHashEl = document.getElementById("latestHash");
const resultEl = document.getElementById("blockchainResult");

// L'identifiant provient de l'URL du dossier patient.
const patientId = new URLSearchParams(window.location.search).get("id");

let provider = null;
let signer = null;
let contract = null;
let currentHash = null;

if (patientId) {
  patientIdEl.textContent = patientId;
} else {
  patientIdEl.textContent = "Identifiant absent de l'URL";
}

function showMessage(message, color = "#334155") {
  resultEl.textContent = message;
  resultEl.style.color = color;
}

function showDossierHashStatus(message, color = "#1d4ed8") {
  dossierHashStatusEl.textContent = message;
  dossierHashStatusEl.style.color = color;
}

function showStoreHashStatus(message, color = "#334155", background = "#f1f5f9") {
  storeHashStatusEl.textContent = message;
  storeHashStatusEl.style.color = color;
  storeHashStatusEl.style.backgroundColor = background;
}

function setConnectedButtons(enabled) {
  loadBtn.disabled = !enabled;
  storeBtn.disabled = !enabled;
  verifyBtn.disabled = !enabled;
  verifyDossierHashBtn.disabled = !enabled;
}

function getErrorMessage(error) {
  return error.shortMessage || error.reason || error.message ||
    "Une erreur inconnue est survenue.";
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((sorted, key) => {
      sorted[key] = canonicalize(value[key]);
      return sorted;
    }, {});
  }

  return value;
}

function showConnectionError(error) {
  let message;

  if (!window.ethereum) {
    message = "MetaMask n'est pas disponible dans ce navigateur.";
  } else if (
    error.code === 4001 ||
    error.info?.error?.code === 4001 ||
    error.cause?.code === 4001
  ) {
    message = "Connexion refusée dans MetaMask.";
  } else if (error.code === "WRONG_NETWORK") {
    message = error.message;
  } else {
    message = `Erreur de connexion : ${getErrorMessage(error)}`;
  }

  statusEl.textContent = message;
  showMessage(message, "#b91c1c");
}

// Vérifie que MetaMask et le réseau attendu sont disponibles.
async function connectWallet() {
  if (!window.ethereum) {
    throw new Error(
      "MetaMask n'est pas disponible dans ce navigateur."
    );
  }

  if (!window.ethers) {
    throw new Error(
      "La bibliothèque ethers.js n'est pas chargée."
    );
  }

  const accounts = await window.ethereum.request({
    method: "eth_requestAccounts"
  });

  if (!accounts || accounts.length === 0) {
    throw new Error("Aucun compte MetaMask disponible.");
  }

  provider = new ethers.BrowserProvider(window.ethereum);

  const network = await provider.getNetwork();

  if (network.chainId !== EXPECTED_CHAIN_ID) {
    contract = null;
    signer = null;
    addressEl.textContent = "—";
    setConnectedButtons(false);

    networkEl.textContent = "Réseau non reconnu";
    chainIdEl.textContent = network.chainId.toString();

    const error = new Error(
      "Mauvais réseau. Sélectionnez Hardhat Local, Chain ID 31337."
    );
    error.code = "WRONG_NETWORK";
    throw error;
  }

  signer = await provider.getSigner();

  contract = new ethers.Contract(
    CONTRACT_ADDRESS,
    CONTRACT_ABI,
    signer
  );

  addressEl.textContent = await signer.getAddress();
  networkEl.textContent = "Hardhat Local";
  chainIdEl.textContent = network.chainId.toString();
  statusEl.textContent = "MetaMask est connecté.";

  setConnectedButtons(true);

  showMessage(
    "Connexion réussie. Contrat prêt à être vérifié.",
    "#15803d"
  );

  // Vérifie que l'adresse contient bien du code de contrat.
  const code = await provider.getCode(CONTRACT_ADDRESS);

  if (code === "0x") {
    contract = null;
    setConnectedButtons(false);

    throw new Error(
      "Aucun contrat trouvé à l'adresse configurée. " +
      "Vérifiez l'adresse du dernier déploiement."
    );
  }

  // Charger les informations initiales.
  await refreshBlockchainData();
}

// Récupère les données du dossier depuis l'application médicale.
// On exclut les champs d'affichage blockchain, qui ne font pas
// partie du dossier médical.
async function getDossierData() {
  if (!patientId) {
    throw new Error(
      "Identifiant du patient absent de l'URL."
    );
  }

  const dossier = await apiFetch(
    `/api/doctor/patients/${encodeURIComponent(patientId)}/dossier`
  );

  if (!dossier || typeof dossier !== "object") {
    throw new Error(
      "L'API n'a pas renvoyé un dossier médical valide."
    );
  }

  return dossier;
}

// Calcule une empreinte Keccak-256 compatible avec le type bytes32.
async function calculateDossierHash() {
  const dossier = await getDossierData();

  const dossierJSON = JSON.stringify(canonicalize(dossier), null, 2);

  const hash = ethers.keccak256(
    ethers.toUtf8Bytes(dossierJSON)
  );

  currentHash = hash;
  calculatedHashEl.textContent = hash;
  canonicalDossierJsonEl.textContent = dossierJSON;

  const consultations = Array.isArray(dossier.consultations)
    ? dossier.consultations
    : [];
  const diagnosticCount = consultations.reduce(
    (total, consultation) => total +
      (Array.isArray(consultation.diagnostics)
        ? consultation.diagnostics.length
        : 0),
    0
  );
  const prescriptionCount = consultations.reduce(
    (total, consultation) => total +
      (Array.isArray(consultation.prescriptions)
        ? consultation.prescriptions.length
        : 0),
    0
  );

  dossierHashCountsEl.textContent =
    `${consultations.length} consultation(s), ` +
    `${diagnosticCount} diagnostic(s), ` +
    `${prescriptionCount} prescription(s)`;
  showDossierHashStatus(
    "Empreinte calculée côté navigateur. Le hash hexadécimal de 32 octets est prêt pour le smart contract."
  );
  return hash;
}

async function recalculateDossierHash() {
  recalculateHashBtn.disabled = true;

  try {
    showDossierHashStatus("Calcul de l'empreinte en cours...");
    await calculateDossierHash();
  } catch (error) {
    showDossierHashStatus(
      `Erreur de calcul : ${getErrorMessage(error)}`,
      "#b91c1c"
    );
  } finally {
    recalculateHashBtn.disabled = false;
  }
}

// Lit le nombre de versions et le dernier hash du contrat.
async function refreshBlockchainData() {
  if (!contract) {
    throw new Error(
      "Connectez MetaMask au réseau Hardhat Local."
    );
  }

  if (!patientId) {
    throw new Error(
      "Impossible de lire le contrat sans identifiant patient."
    );
  }

  const count = await contract.getVersionCount(patientId);

  versionCountEl.textContent = count.toString();

  if (count === 0n) {
    latestHashEl.textContent = "Aucun hash enregistré";
    return;
  }

  const latest = await contract.getLatestHash(patientId);

  latestHashEl.textContent = latest;
}

// Bouton de connexion.
connectBtn.addEventListener("click", async () => {
  connectBtn.disabled = true;
  showMessage("Connexion à MetaMask en cours...");

  try {
    await connectWallet();
  } catch (error) {
    showConnectionError(error);
  } finally {
    connectBtn.disabled = false;
  }
});

// Bouton de lecture des informations blockchain.
loadBtn.addEventListener("click", async () => {
  try {
    showMessage("Lecture des informations blockchain...");

    await refreshBlockchainData();

    showMessage(
      "Informations du dossier chargées avec succès.",
      "#15803d"
    );
  } catch (error) {
    showMessage(
      `Erreur de lecture : ${getErrorMessage(error)}`,
      "#b91c1c"
    );
  }
});

// Enregistre l'empreinte du dossier dans le contrat.
storeBtn.addEventListener("click", async () => {
  if (!contract) {
    showStoreHashStatus(
      "Échec : connectez MetaMask au réseau Hardhat Local (Chain ID 31337).",
      "#b91c1c",
      "#fef2f2"
    );
    return;
  }

  storeBtn.disabled = true;
  storeHashTransactionEl.textContent = "";

  try {
    showStoreHashStatus(
      "Étape 1/4 — Récupération du dossier et calcul de son empreinte Keccak-256...",
      "#1d4ed8",
      "#eff6ff"
    );
    showMessage("Calcul de l'empreinte du dossier...");

    const hash = await calculateDossierHash();

    showStoreHashStatus(
      "Étape 2/4 — Empreinte prête. Validez la transaction dans la fenêtre MetaMask.",
      "#1d4ed8",
      "#eff6ff"
    );
    showMessage(
      "Empreinte calculée. Confirmez la transaction dans MetaMask."
    );

    const transaction = await contract.storeHash(
      patientId,
      hash
    );

    storeHashTransactionEl.textContent =
      `Transaction envoyée : ${transaction.hash}`;
    showStoreHashStatus(
      "Étape 3/4 — Transaction envoyée. Attente de sa confirmation sur Hardhat...",
      "#92400e",
      "#fffbeb"
    );
    showMessage(
      `Transaction envoyée : ${transaction.hash}`
    );

    const receipt = await transaction.wait();

    if (!receipt || receipt.status !== 1) {
      throw new Error(
        "La transaction a été incluse mais a échoué (statut d'échec)."
      );
    }

    showStoreHashStatus(
      "Étape 4/4 — Transaction confirmée. Actualisation des informations du dossier...",
      "#1d4ed8",
      "#eff6ff"
    );
    await refreshBlockchainData();

    showStoreHashStatus(
      `Enregistrement réussi : la transaction est confirmée. ` +
      `Version ${versionCountEl.textContent} enregistrée ; le dernier hash ` +
      `ci-dessus correspond à l'empreinte du dossier.`,
      "#166534",
      "#f0fdf4"
    );
    showMessage(
      "Empreinte enregistrée avec succès sur la blockchain.",
      "#15803d"
    );
  } catch (error) {
    const wasRejected =
      error.code === 4001 ||
      error.info?.error?.code === 4001 ||
      error.cause?.code === 4001;
    const message = wasRejected
      ? "Transaction refusée dans MetaMask. Aucun hash n'a été enregistré."
      : `Échec de l'enregistrement : ${getErrorMessage(error)}`;

    showStoreHashStatus(message, "#b91c1c", "#fef2f2");
    showMessage(message, "#b91c1c");
  } finally {
    storeBtn.disabled = !contract;
  }
});

// Compare l'empreinte courante avec le dernier hash enregistré.
verifyBtn.addEventListener("click", async () => {
  if (!contract) {
    showMessage(
      "Connectez d'abord MetaMask.",
      "#b91c1c"
    );
    return;
  }

  verifyBtn.disabled = true;

  try {
    showMessage("Calcul du hash et vérification de l'intégrité...");

    const hash = await calculateDossierHash();

    const count = await contract.getVersionCount(patientId);

    versionCountEl.textContent = count.toString();

    if (count === 0n) {
      latestHashEl.textContent = "Aucun hash enregistré";

      showMessage(
        "Aucun hash enregistré : enregistrez d'abord le dossier.",
        "#b45309"
      );

      return;
    }

    const latest = await contract.getLatestHash(patientId);
    latestHashEl.textContent = latest;

    const isValid = await contract.verifyHash(
      patientId,
      hash
    );

    if (isValid) {
      showMessage(
        "Intégrité vérifiée : le dossier correspond à un hash enregistré.",
        "#15803d"
      );
    } else {
      showMessage(
        "Intégrité compromise : le dossier ne correspond à aucun hash enregistré.",
        "#b91c1c"
      );
    }
  } catch (error) {
    showMessage(
      `Erreur de vérification : ${getErrorMessage(error)}`,
      "#b91c1c"
    );
  } finally {
    verifyBtn.disabled = !contract;
  }
});

recalculateHashBtn.addEventListener("click", recalculateDossierHash);

copyHashBtn.addEventListener("click", async () => {
  if (!currentHash) {
    showDossierHashStatus(
      "Calculez d'abord l'empreinte du dossier.",
      "#b45309"
    );
    return;
  }

  try {
    await navigator.clipboard.writeText(currentHash);
    showDossierHashStatus("Empreinte copiée dans le presse-papiers.");
  } catch (error) {
    showDossierHashStatus(
      `Impossible de copier l'empreinte : ${getErrorMessage(error)}`,
      "#b91c1c"
    );
  }
});

toggleDossierJsonBtn.addEventListener("click", () => {
  canonicalDossierJsonEl.hidden = !canonicalDossierJsonEl.hidden;
  toggleDossierJsonBtn.textContent = canonicalDossierJsonEl.hidden
    ? "Afficher le JSON canonique"
    : "Masquer le JSON canonique";
});

verifyDossierHashBtn.addEventListener("click", () => {
  verifyBtn.click();
});

// Réagir aux changements de compte MetaMask.
if (window.ethereum) {
  window.ethereum.on("accountsChanged", (accounts) => {
    contract = null;
    signer = null;
    setConnectedButtons(false);

    if (accounts.length === 0) {
      addressEl.textContent = "—";
      statusEl.textContent = "MetaMask n'est pas connecté.";
      showMessage("Aucun compte sélectionné.");
    } else {
      connectWallet().catch((error) => {
        showConnectionError(error);
      });
    }
  });

  // Recharger les informations si le réseau change.
  window.ethereum.on("chainChanged", () => {
    window.location.reload();
  });
} else {
  const message = "MetaMask n'est pas disponible dans ce navigateur.";
  statusEl.textContent = message;
  showMessage(message, "#b91c1c");
}

recalculateDossierHash();
}