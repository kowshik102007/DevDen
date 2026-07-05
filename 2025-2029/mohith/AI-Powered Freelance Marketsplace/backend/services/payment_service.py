from backend.models.db import db
from backend.models.wallet import Wallet, Transaction
from backend.models.payment import Payment
from backend.models.order import Order
from backend.models.user import User
from backend.config import Config
from decimal import Decimal
import uuid

class PaymentService:
    @staticmethod
    def initialize_wallet(user_id):
        """
        Creates a wallet for a newly registered user if it doesn't exist.
        """
        existing = Wallet.query.filter_by(user_id=user_id).first()
        if not existing:
            wallet = Wallet(user_id=user_id, balance=0.00, pending_balance=0.00)
            db.session.add(wallet)
            db.session.commit()
            return wallet
        return existing

    @staticmethod
    def process_checkout(order_id, payment_method, amount):
        """
        Processes order checkouts.
        Simulates payment gateway success and creates wallet transactions.
        1. Debits/charges the client (external mock Stripe/Razorpay or internal wallet).
        2. Transfers commission to admin wallet (user_id = 1).
        3. Puts remainder in freelancer's pending_balance.
        """
        try:
            order = Order.query.get(order_id)
            if not order:
                return False, "Order not found"
                
            # Create transaction ID
            txn_id = f"txn_{uuid.uuid4().hex[:16]}"
            
            # 1. Process payment entry
            payment = Payment(
                order_id=order_id,
                status='completed',
                transaction_id=txn_id,
                method=payment_method,
                amount=amount
            )
            db.session.add(payment)
            
            # If payment is from client's wallet, debit client's wallet
            if payment_method == 'Wallet':
                client_wallet = Wallet.query.filter_by(user_id=order.client_id).first()
                if not client_wallet or client_wallet.balance < amount:
                    return False, "Insufficient wallet balance"
                client_wallet.balance -= amount
                
                # Record transaction
                client_txn = Transaction(
                    wallet_id=client_wallet.id,
                    amount=amount,
                    type='debit',
                    description=f"Purchase for Gig: '{order.service.title[:50]}...' (Order #{order.id})",
                    status='completed'
                )
                db.session.add(client_txn)
                
            # Calculate commission & payout
            amount = Decimal(amount)
            commission_percent = Decimal(Config.ADMIN_COMMISSION_PERCENT)
            commission_amt = amount * (commission_percent / Decimal(100))
            payout_amt = amount - commission_amt
            
            # 2. Add commission to Admin wallet (User ID 1 is seeded as admin)
            admin_wallet = Wallet.query.filter_by(user_id=1).first()
            if admin_wallet:
                admin_wallet.balance += commission_amt
                admin_txn = Transaction(
                    wallet_id=admin_wallet.id,
                    amount=commission_amt,
                    type='credit',
                    description=f"Admin Commission ({commission_percent}%) from Order #{order.id}",
                    status='completed'
                )
                db.session.add(admin_txn)
                
            # 3. Add payout to freelancer's pending balance
            freelancer_wallet = Wallet.query.filter_by(user_id=order.freelancer_id).first()
            if not freelancer_wallet:
                # Create wallet if missing
                freelancer_wallet = Wallet(user_id=order.freelancer_id, balance=0.00, pending_balance=0.00)
                db.session.add(freelancer_wallet)
                db.session.flush() # get ID
                
            freelancer_wallet.pending_balance += payout_amt
            
            # Record pending transaction
            freelancer_txn = Transaction(
                wallet_id=freelancer_wallet.id,
                amount=payout_amt,
                type='credit',
                description=f"Pending payout for Order #{order.id} (Escrow)",
                status='pending'
            )
            db.session.add(freelancer_txn)
            
            # Update order status to active
            order.status = 'active'
            
            db.session.commit()
            return True, txn_id
        except Exception as e:
            db.session.rollback()
            return False, str(e)

    @staticmethod
    def release_escrow(order_id):
        """
        Called when client accepts delivery (order status completed).
        Moves the pending payout amount to the freelancer's active balance.
        """
        try:
            order = Order.query.get(order_id)
            if not order or order.status != 'completed':
                return False, "Order must be completed to release escrow"
                
            commission_percent = Decimal(Config.ADMIN_COMMISSION_PERCENT)
            amount = Decimal(order.price)
            payout_amt = amount * (Decimal(1) - (commission_percent / Decimal(100)))
            
            # Release to freelancer
            freelancer_wallet = Wallet.query.filter_by(user_id=order.freelancer_id).first()
            if freelancer_wallet:
                # Debit from pending, credit to actual balance
                freelancer_wallet.pending_balance = max(0, freelancer_wallet.pending_balance - payout_amt)
                freelancer_wallet.balance += payout_amt
                
                # Update the transaction status from pending to completed
                txn = Transaction.query.filter_by(
                    wallet_id=freelancer_wallet.id,
                    amount=payout_amt,
                    type='credit',
                    status='pending'
                ).first()
                if txn:
                    txn.status = 'completed'
                    txn.description = f"Cleared payout for Order #{order.id}"
                else:
                    # Log new clearance transaction
                    clear_txn = Transaction(
                        wallet_id=freelancer_wallet.id,
                        amount=payout_amt,
                        type='credit',
                        description=f"Cleared payout for Order #{order.id}",
                        status='completed'
                    )
                    db.session.add(clear_txn)
                    
                # Update total earnings in profile
                profile = order.freelancer.freelancer_profile
                if profile:
                    profile.earnings = (profile.earnings or 0) + payout_amt
                    profile.completed_jobs = (profile.completed_jobs or 0) + 1
                    
                db.session.commit()
                return True, "Escrow released successfully"
            return False, "Freelancer wallet not found"
        except Exception as e:
            db.session.rollback()
            return False, str(e)

    @staticmethod
    def process_refund(order_id, reason="Client Dispute"):
        """
        Called when admin issues a refund (order status refunded).
        Reverts the money:
        - Debits pending payout from freelancer.
        - Debits commission from admin.
        - Credits full refund amount to client's wallet.
        """
        try:
            order = Order.query.get(order_id)
            if not order:
                return False, "Order not found"
                
            # Can only refund active, delivered, or pending orders
            if order.status in ['completed', 'refunded', 'cancelled']:
                return False, "Order cannot be refunded in its current state"
                
            amount = Decimal(order.price)
            commission_percent = Decimal(Config.ADMIN_COMMISSION_PERCENT)
            commission_amt = amount * (commission_percent / Decimal(100))
            payout_amt = amount - commission_amt
            
            # Revert freelancer pending
            freelancer_wallet = Wallet.query.filter_by(user_id=order.freelancer_id).first()
            if freelancer_wallet:
                freelancer_wallet.pending_balance = max(0, freelancer_wallet.pending_balance - payout_amt)
                
                # Delete or fail the pending transaction
                txn = Transaction.query.filter_by(
                    wallet_id=freelancer_wallet.id,
                    amount=payout_amt,
                    type='credit',
                    status='pending'
                ).first()
                if txn:
                    txn.status = 'failed'
                    txn.description = f"Refunded Order #{order.id} - Payout Cancelled"
                    
            # Revert Admin commission
            admin_wallet = Wallet.query.filter_by(user_id=1).first()
            if admin_wallet:
                admin_wallet.balance = max(0, admin_wallet.balance - commission_amt)
                admin_txn = Transaction(
                    wallet_id=admin_wallet.id,
                    amount=commission_amt,
                    type='debit',
                    description=f"Reverted commission for Refunded Order #{order.id}",
                    status='completed'
                )
                db.session.add(admin_txn)
                
            # Refund client
            client_wallet = Wallet.query.filter_by(user_id=order.client_id).first()
            if not client_wallet:
                client_wallet = Wallet(user_id=order.client_id, balance=0.00, pending_balance=0.00)
                db.session.add(client_wallet)
                db.session.flush()
                
            client_wallet.balance += amount
            client_txn = Transaction(
                wallet_id=client_wallet.id,
                amount=amount,
                type='credit',
                description=f"Refund received for Order #{order.id} - Reason: {reason}",
                status='completed'
            )
            db.session.add(client_txn)
            
            # Set order status to refunded
            order.status = 'refunded'
            
            db.session.commit()
            return True, "Refund processed successfully"
        except Exception as e:
            db.session.rollback()
            return False, str(e)
