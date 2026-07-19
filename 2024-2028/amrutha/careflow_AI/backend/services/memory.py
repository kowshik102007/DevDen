"""Simple in-memory vector/memory store placeholder"""

class MemoryStore:
    def __init__(self):
        self.store = []

    def add(self, item):
        self.store.append(item)

    def query(self, q):
        return []
