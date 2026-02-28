import { db } from './firebase.js';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const LANG_KEY = 'where2dive_lang';

const i18n = {
  ko: {
    title: '문의하기',
    emailTitle: '이메일',
    emailDesc: '질문, 버그 리포트, 또는 서비스 제안은 아래 이메일로 연락해주세요:',
    formTitle: '문의 양식',
    name: '이름',
    email: '이메일',
    subject: '제목',
    message: '내용',
    send: '보내기',
    sending: '전송 중...',
    success: '메시지가 전송되었습니다. 감사합니다!',
    error: '전송에 실패했습니다. 다시 시도해주세요.',
    responseTitle: '응답 시간',
    responseDesc: '문의에 대한 응답은 일반적으로 1-3 영업일 이내에 처리됩니다.',
    feedbackTitle: '피드백',
    feedbackDesc: 'Where2Dive를 개선하기 위한 여러분의 의견을 항상 환영합니다. 새로운 기능 제안, 데이터 오류 신고, UX 개선 아이디어 등 무엇이든 보내주세요.',
    navHome: '홈',
    navAbout: '소개',
    navGuide: '가이드',
  },
  en: {
    title: 'Contact Us',
    emailTitle: 'Email',
    emailDesc: 'For questions, bug reports, or suggestions about the service, please reach out at:',
    formTitle: 'Contact Form',
    name: 'Name',
    email: 'Email',
    subject: 'Subject',
    message: 'Message',
    send: 'Send',
    sending: 'Sending...',
    success: 'Your message has been sent. Thank you!',
    error: 'Failed to send. Please try again.',
    responseTitle: 'Response Time',
    responseDesc: 'We typically respond to inquiries within 1-3 business days.',
    feedbackTitle: 'Feedback',
    feedbackDesc: 'We always welcome your ideas to improve Where2Dive. Whether it\'s feature suggestions, data error reports, or UX improvements — we\'d love to hear from you.',
    navHome: 'Home',
    navAbout: 'About',
    navGuide: 'Guide',
  },
};

function getLang() {
  return localStorage.getItem(LANG_KEY) || 'ko';
}

function t(key) {
  const lang = getLang();
  return (i18n[lang] && i18n[lang][key]) || i18n.ko[key] || key;
}

function applyLabels() {
  const lang = getLang();
  if (lang === 'en') document.documentElement.lang = 'en';

  document.getElementById('page-title').textContent = t('title');
  document.getElementById('contact-email-title').textContent = t('emailTitle');
  document.getElementById('contact-email-desc').textContent = t('emailDesc');
  document.getElementById('contact-form-title').textContent = t('formTitle');
  document.getElementById('contact-name-label').textContent = t('name');
  document.getElementById('contact-email-label').textContent = t('email');
  document.getElementById('contact-subject-label').textContent = t('subject');
  document.getElementById('contact-message-label').textContent = t('message');
  document.getElementById('contact-submit').textContent = t('send');
  document.getElementById('contact-response-title').textContent = t('responseTitle');
  document.getElementById('contact-response-desc').textContent = t('responseDesc');
  document.getElementById('contact-feedback-title').textContent = t('feedbackTitle');
  document.getElementById('contact-feedback-desc').textContent = t('feedbackDesc');
  document.getElementById('nav-home').textContent = t('navHome');
  document.getElementById('nav-about').textContent = t('navAbout');
  document.getElementById('nav-guide').textContent = t('navGuide');
}

function showResult(message, type) {
  const el = document.getElementById('contact-result');
  el.textContent = message;
  el.className = `contact-result contact-result--${type}`;
}

async function sendTelegram(name, email, subject, message) {
  const BOT = '8771139243:AAHTcN6bVTxuPBxTnPMsVRTl4_JjBpUDU8E';
  const CHAT = '6786343916';
  const text = [
    '📬 새 문의가 도착했습니다!',
    '',
    `👤 이름: ${name}`,
    `📧 이메일: ${email}`,
    `📌 제목: ${subject}`,
    '',
    '💬 내용:',
    message,
    '',
    `🕐 시간: ${new Date().toLocaleString('ko-KR')}`,
  ].join('\n');
  const res = await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT, text }),
  });
  if (!res.ok) console.warn('Telegram API error:', res.status, await res.text());
}

const form = document.getElementById('contact-form');
const submitBtn = document.getElementById('contact-submit');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  submitBtn.disabled = true;
  submitBtn.textContent = t('sending');

  const name = document.getElementById('contact-name').value.trim();
  const email = document.getElementById('contact-email').value.trim();
  const subject = document.getElementById('contact-subject').value.trim();
  const message = document.getElementById('contact-message').value.trim();

  try {
    await addDoc(collection(db, 'contacts'), {
      name, email, subject, message,
      createdAt: serverTimestamp(),
      status: 'unread',
    });
    // Telegram 알림 — await하되 실패해도 폼 제출은 성공 처리
    try { await sendTelegram(name, email, subject, message); }
    catch (tgErr) { console.warn('Telegram notify failed:', tgErr); }
    showResult(t('success'), 'success');
    form.reset();
  } catch (err) {
    console.error('Contact submit error:', err);
    showResult(t('error'), 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = t('send');
  }
});

applyLabels();
