// public/patient/js/dashboard.js
requireRole('patient');
document.getElementById('patientNameTop').textContent = localStorage.getItem('name') || '';

function setProfileSummary(profile) {
  document.getElementById('profileSummaryName').textContent = profile.name || '-';
  document.getElementById('profileSummaryEmail').textContent = profile.email || '-';
  document.getElementById('profileSummaryBirthDate').textContent = profile.birth_date || '-';
  document.getElementById('profileSummaryGender').textContent = profile.gender || '-';
  document.getElementById('profileSummaryPhone').textContent = profile.phone || '-';
  document.getElementById('profileSummaryBloodType').textContent = profile.blood_type || '-';
  document.getElementById('profileSummaryAddress').textContent = profile.address || '-';
}

function toggleProfileForm(show) {
  document.getElementById('profileSummary').classList.toggle('hidden', show);
  document.getElementById('profileForm').classList.toggle('hidden', !show);
  document.getElementById('editProfileButton').classList.toggle('hidden', show);
}

async function loadProfile() {
  try {
    const profile = await apiFetch('/api/patient/profile');
    setProfileSummary(profile);
    document.getElementById('profileName').value = profile.name || '';
    document.getElementById('profileEmail').value = profile.email || '';
    document.getElementById('profileBirthDate').value = profile.birth_date || '';
    document.getElementById('profileGender').value = profile.gender || '';
    document.getElementById('profilePhone').value = profile.phone || '';
    document.getElementById('profileBloodType').value = profile.blood_type || '';
    document.getElementById('profileAddress').value = profile.address || '';
  } catch (err) {
    console.error(err);
  }
}

document.getElementById('profileForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const messageEl = document.getElementById('profileMessage');
  const errorEl = document.getElementById('profileError');
  messageEl.textContent = '';
  errorEl.textContent = '';

  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const passwordFields = [currentPassword, newPassword, confirmPassword];
  if (passwordFields.some(Boolean) && passwordFields.some((value) => !value)) {
    errorEl.textContent = 'Remplissez les trois champs du mot de passe.';
    return;
  }

  try {
    const profile = await apiFetch('/api/patient/profile', {
      method: 'PUT',
      body: JSON.stringify({
        name: document.getElementById('profileName').value.trim(),
        email: document.getElementById('profileEmail').value.trim(),
        birth_date: document.getElementById('profileBirthDate').value,
        gender: document.getElementById('profileGender').value,
        phone: document.getElementById('profilePhone').value.trim(),
        blood_type: document.getElementById('profileBloodType').value.trim(),
        address: document.getElementById('profileAddress').value.trim(),
      }),
    });

    if (currentPassword || newPassword || confirmPassword) {
      await apiFetch('/api/patient/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
    }

    localStorage.setItem('name', profile.name);
    document.getElementById('patientNameTop').textContent = profile.name;
    setProfileSummary(profile);
    messageEl.textContent = 'Informations mises à jour.';
    toggleProfileForm(false);
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

document.getElementById('editProfileButton').addEventListener('click', () => toggleProfileForm(true));
document.getElementById('cancelProfileButton').addEventListener('click', () => toggleProfileForm(false));

async function loadDossier() {
  try {
    const dossier = await apiFetch('/api/patient/dossier');
    const container = document.getElementById('dossierContainer');
    container.innerHTML = '';

    if (dossier.consultations.length === 0) {
      container.innerHTML = '<div class="empty-state">Aucune consultation pour le moment.</div>';
      return;
    }

    dossier.consultations.forEach((c) => {
      const block = document.createElement('div');
      block.className = 'consultation-block';

      let diagnosticsHtml = c.diagnostics.length
        ? '<ul class="sub-list">' + c.diagnostics.map(d => `<li>🩺 ${d.description}</li>`).join('') + '</ul>'
        : '<p style="font-size:13px;color:#94a3b8;">Aucun diagnostic.</p>';

      let prescriptionsHtml = c.prescriptions.length
        ? '<ul class="sub-list">' + c.prescriptions.map(p =>
            `<li>💊 <strong>${p.medication}</strong> ${p.dosage ? '- ' + p.dosage : ''} ${p.duration ? '(' + p.duration + ')' : ''}${p.instructions ? '<br><em>' + p.instructions + '</em>' : ''}</li>`
          ).join('') + '</ul>'
        : '<p style="font-size:13px;color:#94a3b8;">Aucune prescription.</p>';

      block.innerHTML = `
        <div class="consultation-header">
          <span class="date">${formatDate(c.date)}</span>
          <span class="badge">Dr ${c.doctor_name}</span>
        </div>
        <p><strong>Motif:</strong> ${c.reason || '-'}</p>
        <p><strong>Notes:</strong> ${c.notes || '-'}</p>
        <p><strong>Diagnostics</strong></p>
        ${diagnosticsHtml}
        <p><strong>Prescriptions</strong></p>
        ${prescriptionsHtml}
      `;
      container.appendChild(block);
    });
  } catch (err) {
    console.error(err);
  }
}

loadProfile();
loadDossier();
