import unittest
import json
import os
import sys

# Ensure backend package is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.app import create_app, db
from backend.models.user import User
from backend.models.service import Service
from backend.models.order import Order
from backend.models.wallet import Wallet

class TestSkillBridgeAPI(unittest.TestCase):
    def setUp(self):
        # Set up a test application with an in-memory database
        self.app = create_app()
        self.app.config['TESTING'] = True
        self.app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        self.app.config['JWT_SECRET_KEY'] = 'test_jwt_secret_key'
        self.client = self.app.test_client()
        
        with self.app.app_context():
            db.create_all()
            
            # Seed test admin, freelancer, client
            admin = User(email='admin@sb.com', first_name='Admin', last_name='User', role='admin')
            admin.set_password('password123')
            
            freelancer = User(email='free@sb.com', first_name='Alex', last_name='Free', role='freelancer')
            freelancer.set_password('password123')
            
            client = User(email='client@sb.com', first_name='Elena', last_name='Client', role='client')
            client.set_password('password123')
            
            db.session.add_all([admin, freelancer, client])
            db.session.commit()
            
            # Create profiles & wallets
            from backend.models.user import FreelancerProfile, ClientProfile
            from backend.services.payment_service import PaymentService
            
            PaymentService.initialize_wallet(admin.id)
            PaymentService.initialize_wallet(freelancer.id)
            client_wallet = PaymentService.initialize_wallet(client.id)
            client_wallet.balance = 10000.00 # seed wallet balance
            
            f_profile = FreelancerProfile(user_id=freelancer.id, title='AI dev', skills='python,react')
            c_profile = ClientProfile(user_id=client.id, company='StartInc')
            db.session.add_all([f_profile, c_profile])
            db.session.commit()
            
            # Create a test service
            service = Service(
                freelancer_id=freelancer.id,
                title='Test AI Chatbot',
                description='I build chatbots',
                price=5000.00,
                delivery_days=3,
                category='Artificial Intelligence'
            )
            db.session.add(service)
            db.session.commit()
            self.service_id = service.id

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    def get_jwt_token(self, email, password):
        res = self.client.post('/api/auth/login', json={
            'email': email,
            'password': password
        })
        data = json.loads(res.data)
        return data['token']

    def test_auth_endpoints(self):
        res = self.client.post('/api/auth/register', json={
            'email': 'newuser@sb.com',
            'password': 'password123',
            'first_name': 'New',
            'last_name': 'User',
            'role': 'client'
        })
        self.assertEqual(res.status_code, 201)
        data = json.loads(res.data)
        self.assertIn('token', data)
        
        token = self.get_jwt_token('client@sb.com', 'password123')
        self.assertIsNotNone(token)

    def test_marketplace_endpoints(self):
        res = self.client.get('/api/services')
        self.assertEqual(res.status_code, 200)
        services = json.loads(res.data)
        self.assertGreaterEqual(len(services), 1)

    def test_checkout_and_order_flow(self):
        client_token = self.get_jwt_token('client@sb.com', 'password123')
        
        # 1. Create order
        res = self.client.post('/api/orders', json={
            'service_id': self.service_id,
            'requirements': 'Build standard FAQ parser'
        }, headers={'Authorization': f'Bearer {client_token}'})
        self.assertEqual(res.status_code, 201)
        order_data = json.loads(res.data)
        order_id = order_data['order']['id']
        
        # 2. Checkout payment
        res = self.client.post('/api/payments/checkout', json={
            'order_id': order_id,
            'method': 'Credit Card'
        }, headers={'Authorization': f'Bearer {client_token}'})
        
        if res.status_code != 200:
            print("Checkout API Error details:", res.status_code, res.data.decode('utf-8'))
            
        self.assertEqual(res.status_code, 200)
        
        # 3. Retrieve orders
        res = self.client.get('/api/orders', headers={'Authorization': f'Bearer {client_token}'})
        self.assertEqual(res.status_code, 200)
        orders = json.loads(res.data)
        self.assertEqual(orders[0]['status'], 'active')

    def test_chatbot_support(self):
        res = self.client.post('/api/messages/chatbot', json={
            'message': 'Hi chatbot, how do I get a refund?'
        })
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertIn('reply', data)

if __name__ == '__main__':
    unittest.main()
