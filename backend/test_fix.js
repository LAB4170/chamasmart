const mockNotifications = [
  {
    notification_id: 51,
    type: 'JOIN_REQUEST',
    entity_type: 'JOIN_REQUEST',
    entity_id: 5,
    link: '/chamas/1/join-requests'
  },
  {
    notification_id: 100,
    type: 'JOIN_REQUEST',
    entity_type: 'CHAMA',
    entity_id: 1,
    link: null
  },
  {
    notification_id: 101,
    type: 'LOAN_GUARANTEE_REQUEST',
    link: '#'
  }
];

function transform(n) {
  // Logic from notificationController.js
  let link = n.link || '#';
  const metadata = n.metadata || {};
  
  if (!n.link || n.link === '#') {
    switch (n.type) {
      case 'LOAN_GUARANTEE_REQUEST':
        link = '/my-guarantees';
        break;
      case 'LOAN_GUARANTEE_REJECTED':
        link = '/dashboard'; 
        break;
      case 'JOIN_REQUEST':
        if (n.entity_id && n.entity_type === 'CHAMA') {
          link = `/chamas/${n.entity_id}/join-requests`;
        }
        break;
      case 'JOIN_APPROVED':
      case 'JOIN_REJECTED':
        if (n.entity_id && n.entity_type === 'CHAMA') {
          link = `/chamas/${n.entity_id}`;
        }
        break;
      case 'LOAN_APPROVED':
      case 'LOAN_REJECTED':
      case 'LOAN_PAYMENT_DUE':
        link = '/dashboard';
        break;
    }
  }
  return { ...n, link };
}

const results = mockNotifications.map(transform);
console.log(JSON.stringify(results, null, 2));

// Assertions
const nid51 = results.find(n => n.notification_id === 51);
if (nid51.link === '/chamas/1/join-requests') {
  console.log('✅ TEST 1 PASSED: Prioritized DB link over entity_id 5');
} else {
  console.log('❌ TEST 1 FAILED: Overwrote DB link with ' + nid51.link);
}

const nid100 = results.find(n => n.notification_id === 100);
if (nid100.link === '/chamas/1/join-requests') {
  console.log('✅ TEST 2 PASSED: Fallback generated for missing link');
} else {
  console.log('❌ TEST 2 FAILED: Fallback failed, got ' + nid100.link);
}

const nid101 = results.find(n => n.notification_id === 101);
if (nid101.link === '/my-guarantees') {
  console.log('✅ TEST 3 PASSED: Fallback generated for # link');
} else {
  console.log('❌ TEST 3 FAILED: Fallback failed for #');
}
