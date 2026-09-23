// public/doctor/js/dashboard.js
requireRole('medecin');
document.getElementById('doctorName').textContent = 'Dr ' + (localStorage.getItem('name') || '');

function setDoctorProfileSummary(profile) {
  document.getElementById('doctorSummaryName').textContent = profile.name || '-';
  document.getElementById('doctorSummaryEmail').textContent = profile.email || '-';
  document.getElementById('doctorSummarySpecialty').textContent = profile.specialty || '-';
  document.getElementById('doctorSummaryPhone').textContent = profile.phone || '-';
}

function toggleDoctorProfileForm(show) {
  document.getElementById('doctorProfileSummary').classList.toggle('hidden', show);
  document.getElementById('doctorProfileForm').classList.toggle('hidden', !show);
  document.getElementById('editDoctorProfileButton').classList.toggle('hidden', show);
}

async function loadDoctorProfile() {
  try {
    const profile = await apiFetch('/api/doctor/profile');
    setDoctorProfileSummary(profile);
    document.getElementById('doctorProfileName').value = profile.name || '';
    document.getElementById('doctorProfileEmail').value = profile.email || '';
    document.getElementById('doctorProfileSpecialty').value = profile.specialty || '';
    document.getElementById('doctorProfilePhone').value = profile.phone || '';
  } catch (err) {
    console.error(err);
  }
}

document.getElementById('doctorProfileForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const messageEl = document.getElementById('doctorProfileMessage');
  const errorEl = document.getElementById('doctorProfileError');
  messageEl.textContent = '';
  errorEl.textContent = '';

  const currentPassword = document.getElementById('doctorCurrentPassword').value;
  const newPassword = document.getElementById('doctorNewPassword').value;
  const confirmPassword = document.getElementById('doctorConfirmPassword').value;
  const passwordFields = [currentPassword, newPassword, confirmPassword];
  if (passwordFields.some(Boolean) && passwordFields.some((value) => !value)) {
    errorEl.textContent = 'Remplissez les trois champs du mot de passe.';
    return;
  }

  try {
    const profile = await apiFetch('/api/doctor/profile', {
      method: 'PUT',
      body: JSON.stringify({
        name: document.getElementById('doctorProfileName').value.trim(),
        email: document.getElementById('doctorProfileEmail').value.trim(),
        specialty: document.getElementById('doctorProfileSpecialty').value.trim(),
        phone: document.getElementById('doctorProfilePhone').value.trim(),
      }),
    });

    if (currentPassword || newPassword || confirmPassword) {
      await apiFetch('/api/doctor/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
    }

    localStorage.setItem('name', profile.name);
    document.getElementById('doctorName').textContent = 'Dr ' + profile.name;
    setDoctorProfileSummary(profile);
    messageEl.textContent = 'Informations mises à jour.';
    toggleDoctorProfileForm(false);
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

document.getElementById('editDoctorProfileButton').addEventListener('click', () => toggleDoctorProfileForm(true));
document.getElementById('cancelDoctorProfileButton').addEventListener('click', () => toggleDoctorProfileForm(false));

async function loadPatients() {
  try {
    const patients = await apiFetch('/api/doctor/patients');
    const tbody = document.getElementById('patientsBody');
    const emptyState = document.getElementById('emptyState');
    tbody.innerHTML = '';

    if (patients.length === 0) {
      emptyState.classList.remove('hidden');
      return;
    }
    emptyState.classList.add('hidden');

    patients.forEach((p) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.name}</td>
        <td>${p.email}</td>
        <td>${p.birth_date || '-'}</td>
        <td>${p.gender || '-'}</td>
        <td><button class="link-btn" onclick="openPatient(${p.patient_id})">Voir le dossier →</button></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    alert(err.message);
  }
}

function openPatient(patientId) {
  window.location.href = `patient.html?id=${patientId}`;
}

loadDoctorProfile();
loadPatients();
