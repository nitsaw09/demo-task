
# 📲 Multichain Wallet – Real-Time Push Notification System

Overview on implementing a real-time push notifications for users when they receive new transactions across multiple blockchains including **EVM**, **Solana**, **Tron**, and **TON**.

---

## 🚀 Supported Blockchains

- ✅ EVM Chains (Ethereum, Polygon, BSC, etc.)
- ✅ Solana
- ✅ Tron
- ✅ TON (The Open Network)

---

## 🧠 How It Works

*User registers wallet + device* → *listen for on-chain events* → *Send push notification*

Each chain is handled by its own microservice to ensure scalability, reliability, and real-time performance (target: 100K tx/sec).

---

## 🏗️ Architecture Overview

### 🔌 1. **API Gateway**
- Accepts registration of wallet addresses + mobile push tokens
- Forwards to Auth service and Chain listeners

### 🔐 2. **Auth Service**
- Stores user wallet address mappings and device tokens
- Built with JWT-based auth 

### 🔁 3. **Chain Listeners**
Separate listener microservices per chain:
- **EVM Listener** (via WebSocket: Alchemy/Infura)
- **Solana Listener** (via WebSocket or Helius Webhooks)
- **Tron Listener** (via TronGrid WebSocket or polling)
- **TON Listener** (via Toncenter API or lite-client polling)

### 🧵 4. **Event Broker (Kafka / Pulsar)**
- Captures blockchain events
- Decouples listeners from workers
- Supports high-throughput and message retries

### 🧠 5. **Worker Services**
- One per chain (can scale horizontally)
- Validates txs, matches with user addresses
- Passes valid events to notification service

### 🧊 6. **Notification Buffer (Redis)**
- Dedupe repeated events
- Apply rate-limiting and retries
- Temporarily stores push jobs

### 🔔 7. **Push Gateway**
- Sends notifications to user devices via:
  - AWS SNS
  - Firebase Cloud Messaging (FCM)
  - Apple Push Notification Service (APNs)

### 📱 8. **Mobile App**
- Displays incoming tx notifications
- Uses a separate mnemonic seed phrase for each chain to generate wallets on multiple chains

---

## ✅ Example Notification

```json
{
  "type": "incoming_transaction",
  "chain": "Solana",
  "message": "You've received 0.5 SOL!",
  "txHash": "5Xj...9uT",
  "from": "SenderAddress",
  "timestamp": 1699900123
}
```

---

## 📈 Performance Goals

| Metric                     | Target                                          |
|----------------------------|-------------------------------------------------|
| Real-time detection        | < 5 seconds per transaction                     |
| Throughput                 | 100K+ txs/sec                                   |
| Failure handling           | Auto-retry, backoff, dedupe                     |
| Scaling                    | Horizontally scalable (loadbalancing, sharding) |

---

## 📦 Tech Stack

| Layer           | Technology                             |
|-----------------|----------------------------------------|
| API Gateway     | API Gateway (AWS Cloud)                |
| Auth DB         | PostgreSQL / Redis                     |
| EVM Listener    | ethers.js + Alchemy / Infura           |
| Solana Listener | @solana/web3.js + Helius / QuickNode   |
| Tron Listener   | TronWeb + TronGrid                     |
| TON Listener    | Toncenter API / lite-client            |
| Event Queue     | Kafka                                  |
| Workers         | Node.js                                |
| Caching         | Redis                                  |
| Push Delivery   | AWS SNS / FCM / APNs                   |
| Monitoring      | Prometheus + Grafana                   |

---

## 🔁 Failure Recovery

- ✅ Kafka retains failed events for retries
- ✅ Redis TTL protects against duplication
- ✅ Notification retries with exponential backoff
- ✅ Health checks on all listeners and workers

---

## 📄 Diagrams

### ✅ [Architecture Diagram](https://github.com/onchain-txn/assets/blob/main/multichain_push_architecture.png?raw=true)
![Multichain Push Architecture](https://github.com/onchain-txn/assets/blob/main/multichain_push_architecture.png?raw=true)
