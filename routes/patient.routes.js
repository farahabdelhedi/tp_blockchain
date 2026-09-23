// routes/patient.routes.js
const express = require('express');
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { hashPassword, comparePassword } = require('../utils/password');

const router = express.Router();
router.use(verifyToken, requireRole('patient'));

// GET /api/patient/profile
router.get('/profile', (req, res) => {
  const profile = db
    .prepare(
      `SELECT pp.id as patient_id, u.name, u.email, pp.birth_date, pp.gender, pp.blood_type, pp.phone, pp.address
       FROM patient_profiles pp JOIN users u ON u.id = pp.user_id
       WHERE pp.id = ?`
    )
    .get(req.user.profileId);

  if (!profile) return res.status(404).json({ error: 'Profil introuvable.' });
  res.json(profile);
});

// PUT /api/patient/profile
// Modifie uniquement les informations personnelles du patient.
router.put('/profile', (req, res) => {
  const { name, email, birth_date, gender, phone, blood_type, address } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Le nom et l\'email sont requis.' });
  }

  if (birth_date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birth_date)) {
      return res.status(400).json({ error: 'La date de naissance est invalide.' });
    }

    const parsedBirthDate = new Date(`${birth_date}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [year, month, day] = birth_date.split('-').map(Number);

    if (
      Number.isNaN(parsedBirthDate.getTime()) ||
      parsedBirthDate.getFullYear() !== year ||
      parsedBirthDate.getMonth() !== month - 1 ||
      parsedBirthDate.getDate() !== day ||
      parsedBirthDate > today
    ) {
      return res.status(400).json({ error: 'La date de naissance est invalide.' });
    }
  }

  const duplicateEmail = db
    .prepare('SELECT id FROM users WHERE email = ? AND id != ?')
    .get(email, req.user.id);
  if (duplicateEmail) {
    return res.status(409).json({ error: 'Un compte existe deja avec cet email.' });
  }

  const updateProfile = db.transaction(() => {
    db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(name, email, req.user.id);
    db
      .prepare(
        `UPDATE patient_profiles
         SET birth_date = ?, gender = ?, phone = ?, blood_type = ?, address = ?
         WHERE id = ?`
      )
      .run(birth_date || null, gender || null, phone || null, blood_type || null, address || null, req.user.profileId);
  });

  try {
    updateProfile();
  } catch (err) {
    return res.status(400).json({ error: 'Impossible de mettre a jour le profil.' });
  }

  const updatedProfile = db
    .prepare(
      `SELECT pp.id as patient_id, u.name, u.email, pp.birth_date, pp.gender, pp.blood_type, pp.phone, pp.address
       FROM patient_profiles pp JOIN users u ON u.id = pp.user_id
       WHERE pp.id = ?`
    )
    .get(req.user.profileId);

  res.json(updatedProfile);
});

// PUT /api/patient/password
router.put('/password', (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ error: 'Tous les champs du mot de passe sont requis.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 6 caracteres.' });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'Les nouveaux mots de passe ne correspondent pas.' });
  }

  const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id);
  if (!user || !comparePassword(currentPassword, user.password)) {
    return res.status(401).json({ error: 'Le mot de passe actuel est incorrect.' });
  }

  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashPassword(newPassword), req.user.id);
  res.json({ message: 'Mot de passe modifie avec succes.' });
});

// GET /api/patient/consultations
router.get('/consultations', (req, res) => {
  const consultations = db
    .prepare(
      `SELECT c.id, c.date, c.reason, c.notes, u.name as doctor_name
       FROM consultations c
       JOIN doctor_profiles dp ON dp.id = c.doctor_id
       JOIN users u ON u.id = dp.user_id
       WHERE c.patient_id = ?
       ORDER BY c.date DESC`
    )
    .all(req.user.profileId);
  res.json(consultations);
});

// GET /api/patient/prescriptions
router.get('/prescriptions', (req, res) => {
  const prescriptions = db
    .prepare(
      `SELECT p.*, c.date as consultation_date, u.name as doctor_name
       FROM prescriptions p
       JOIN consultations c ON c.id = p.consultation_id
       JOIN doctor_profiles dp ON dp.id = c.doctor_id
       JOIN users u ON u.id = dp.user_id
       WHERE c.patient_id = ?
       ORDER BY p.created_at DESC`
    )
    .all(req.user.profileId);
  res.json(prescriptions);
});

// GET /api/patient/dossier  (dossier medical complet : consultations + diagnostics + prescriptions)
router.get('/dossier', (req, res) => {
  const patientId = req.user.profileId;

  const consultations = db
    .prepare(
      `SELECT c.id, c.date, c.reason, c.notes, u.name as doctor_name
       FROM consultations c
       JOIN doctor_profiles dp ON dp.id = c.doctor_id
       JOIN users u ON u.id = dp.user_id
       WHERE c.patient_id = ?
       ORDER BY c.date DESC`
    )
    .all(patientId);

  const consultationIds = consultations.map((c) => c.id);
  let diagnostics = [];
  let prescriptions = [];
  if (consultationIds.length > 0) {
    const placeholders = consultationIds.map(() => '?').join(',');
    diagnostics = db
      .prepare(`SELECT * FROM diagnostics WHERE consultation_id IN (${placeholders})`)
      .all(...consultationIds);
    prescriptions = db
      .prepare(`SELECT * FROM prescriptions WHERE consultation_id IN (${placeholders})`)
      .all(...consultationIds);
  }

  const result = consultations.map((c) => ({
    ...c,
    diagnostics: diagnostics.filter((d) => d.consultation_id === c.id),
    prescriptions: prescriptions.filter((p) => p.consultation_id === c.id),
  }));

  res.json({ consultations: result });
});

module.exports = router;
