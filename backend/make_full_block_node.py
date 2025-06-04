import requests
import time
import hashlib
import struct
import binascii
import os
from multiprocessing import Pool, cpu_count, Manager, Process
from datetime import datetime
import json
import websocket
import bech32
# Получение хеша последнего блока через API
def get_latest_bitcoin_hash():
    try:
        response = requests.get('https://blockchain.info/latestblock')
        response.raise_for_status()
        return response.json()['hash']
    except requests.RequestException as e:
        print(f"Ошибка получения хеша: {e}")
        return None

# Получение bits из mempool.space
def get_bits():
    try:
        response = requests.get('https://mempool.space/api/blocks/tip')
        response.raise_for_status()
        block_data = response.json()
        if isinstance(block_data, list) and len(block_data) > 0:
            bits_value = block_data[0].get('bits')
            if isinstance(bits_value, str):
                return int(bits_value, 16)
            elif isinstance(bits_value, int):
                return bits_value
            else:
                print(f"Ошибка: bits имеет неверный формат, получено: {bits_value}")
                return 0x17025105
        else:
            print("Ошибка: пустой или неверный ответ API blocks/tip")
            return 0x17025105
    except (requests.RequestException, KeyError, ValueError) as e:
        print(f"Ошибка получения bits: {e}")
        return 0x17025105  # Fallback

# Получение данных о последнем блоке через API
def get_latest_block_data():
    try:
        response = requests.get('https://blockchain.info/latestblock')
        response.raise_for_status()
        block_data = response.json()
        prev_hash = block_data['hash']
        block_height = block_data['height'] + 1
        timestamp = int(time.time())
        bits = get_bits()
        print(f"API вернуло: хеш={prev_hash}, высота={block_data['height']}, bits={hex(bits)}")
        return prev_hash, bits, block_height, timestamp
    except requests.RequestException as e:
        raise Exception(f"Ошибка получения данных блока: {e}")

# Получение транзакций через API
def get_mempool_transactions():
    try:
        response = requests.get('https://mempool.space/api/mempool/txids')
        response.raise_for_status()
        txids = response.json()[:10]
        transactions = []
        for txid in txids:
            try:
                tx_response = requests.get(f'https://mempool.space/api/tx/{txid}/hex')
                tx_response.raise_for_status()
                tx_hex = tx_response.text.strip()
                if all(c in '0123456789abcdefABCDEF' for c in tx_hex) and len(tx_hex) % 2 == 0:
                    transactions.append(tx_hex)
                else:
                    print(f"Ошибка: Некорректный HEX в транзакции {txid}, пропускаем")
            except requests.RequestException as e:
                print(f"Ошибка получения транзакции {txid}: {e}")
                continue
        return transactions
    except requests.RequestException as e:
        print(f"Ошибка получения транзакций: {e}")
        return []

# Мониторинг новых блоков
def monitor_new_block(prev_hash_manager, block_height_manager, restart_mining):
    while True:
        try:
            response = requests.get('https://blockchain.info/latestblock')
            response.raise_for_status()
            block_data = response.json()
            new_hash = block_data['hash']
            new_height = block_data['height']
            if new_hash != prev_hash_manager.value:
                print(f"Обнаружен новый блок: {new_hash}, высота: {new_height}")
                prev_hash_manager.value = new_hash
                block_height_manager.value = new_height + 1
                restart_mining.value = True
        except requests.RequestException as e:
            print(f"Ошибка мониторинга: {e}")
        time.sleep(5)

# Двойной SHA-256
def double_sha256(data: bytes) -> bytes:
    return hashlib.sha256(hashlib.sha256(data).digest()).digest()

# Вычисление Merkle root
def compute_merkle_root(transactions):
    if not transactions:
        return double_sha256(b'').hex()
    tx_hashes = []
    for tx in transactions:
        try:
            tx_hashes.append(double_sha256(binascii.unhexlify(tx)).hex())
        except binascii.Error as e:
            print(f"Ошибка преобразования транзакции: {e}, пропускаем")
            continue
    if not tx_hashes:
        return double_sha256(b'').hex()
    while len(tx_hashes) > 1:
        if len(tx_hashes) % 2 != 0:
            tx_hashes.append(tx_hashes[-1])
        new_hashes = []
        for i in range(0, len(tx_hashes), 2):
            combined = binascii.unhexlify(tx_hashes[i] + tx_hashes[i + 1])
            new_hashes.append(double_sha256(combined).hex())
        tx_hashes = new_hashes
    return tx_hashes[0]

# Создание заголовка блока
def create_block_header(prev_hash: str, merkle_root: str, timestamp: int, bits: int, nonce: int) -> bytes:
    version = 0x20000000
    return struct.pack(
        "<L32s32sLLL",
        version,
        binascii.unhexlify(prev_hash)[::-1],
        binascii.unhexlify(merkle_root)[::-1],
        timestamp,
        bits,
        nonce
    )

# Вычисление хеша блока
def get_block_hash(header: bytes) -> str:
    return double_sha256(header)[::-1].hex()

# Преобразование bits в target
def bits_to_target(bits: int) -> int:
    exponent = bits >> 24
    mantissa = bits & 0xffffff
    return mantissa * (1 << (8 * (exponent - 3)))

# Проверка валидности хеша
def is_valid_hash(block_hash: str, target: int) -> bool:
    return int(block_hash, 16) < target

# Преобразование Bech32-адреса в scriptPubKey
def address_to_scriptpubkey(address: str) -> str:
    try:
        # Декодируем Bech32-адрес
        hrp, data = bech32.decode('bc', address)
        if hrp != 'bc' or len(data) != 20:
            raise ValueError("Некорректный Bech32-адрес")
        # Для P2WPKH: OP_0 <20-byte hash>
        scriptpubkey = f"0014{binascii.hexlify(bytes(data)).decode()}"
        return scriptpubkey
    except Exception as e:
        print(f"Ошибка декодирования адреса: {e}")
        return "0014d0e6b0f8f7c8e9d8f8c7e6d5f4c3b2a1f0e9d8c7"  # Fallback

# Создание coinbase-транзакции
def create_coinbase_transaction(block_height: int) -> str:
    subsidy = 312500000  # 3.125 BTC в сатоши
    height_script = struct.pack("<L", block_height).hex()
    script_sig = f"03{height_script}2f4d696e65642062792047686f73742f"
    address = "bc1qqqw07mder6kh66guzue3k4mjdvz37a84fmedp9"  # Ваш адрес
    address_hash = address_to_scriptpubkey(address)
    tx = (
        "01000000" +
        "01" +
        "00" * 32 + "ffffffff" +
        f"{len(script_sig)//2:02x}" + script_sig +
        "ffffffff" +
        "01" +
        struct.pack("<Q", subsidy).hex() +
        f"{len(address_hash)//2:02x}" + address_hash +
        "00000000"
    )
    return tx

# Сборка блока
def assemble_block(header: bytes, coinbase_tx: str, transactions: list) -> str:
    tx_count = len(transactions) + 1
    tx_count_varint = encode_varint(tx_count)
    tx_list = [coinbase_tx] + transactions
    return header.hex() + tx_count_varint + "".join(tx_list)

# Кодирование varint
def encode_varint(n):
    if n < 0xfd:
        return struct.pack("<B", n).hex()
    elif n < 0xffff:
        return "fd" + struct.pack("<H", n).hex()
    elif n < 0xffffffff:
        return "fe" + struct.pack("<L", n).hex()
    else:
        return "ff" + struct.pack("<Q", n).hex()

# Отправка блока (пул или соло)
def submit_block(block_hex: str, mode="solo"):
    if mode == "pool":
        try:
            # Параметры пула (замените на ваши)
            pool_url = "wss://stratum.slushpool.com:3333"
            username = "your_worker_name"  # Например, userID.worker1
            password = "your_password"     # Пароль от пула

            # Подключение к Stratum
            ws = websocket.create_connection(pool_url)
            
            # Авторизация
            auth_msg = {
                "id": 1,
                "method": "mining.authorize",
                "params": [username, password]
            }
            ws.send(json.dumps(auth_msg))
            response = json.loads(ws.recv())
            if not response.get("result", False):
                print(f"Ошибка авторизации в пуле: {response}")
                ws.close()
                return False

            # Отправка блока
            submit_msg = {
                "id": 2,
                "method": "mining.submit",
                "params": [username, block_hex]
            }
            ws.send(json.dumps(submit_msg))
            response = json.loads(ws.recv())
            if response.get("result", False):
                print("\nБлок успешно отправлен в пул!")
                ws.close()
                return True
            else:
                print(f"\nОшибка отправки блока в пул: {response.get('error')}")
                ws.close()
                return False

        except Exception as e:
            print(f"Ошибка отправки блока в пул: {e}")
            return False

    else:  # mode == "solo"
        try:
            # Параметры вашей ноды
            rpc_user = "your_rpc_user"
            rpc_password = "your_rpc_password"
            rpc_url = "http://127.0.0.1:8332"

            # JSON-RPC запрос
            payload = {
                "jsonrpc": "1.0",
                "id": "miner",
                "method": "submitblock",
                "params": [block_hex]
            }

            response = requests.post(
                rpc_url,
                data=json.dumps(payload),
                auth=(rpc_user, rpc_password),
                headers={"Content-Type": "application/json"}
            )
            response.raise_for_status()
            result = response.json()

            if result.get("result") is None:
                print("\nБлок успешно отправлен в сеть!")
                return True
            else:
                print(f"\nОшибка отправки блока: {result.get('error')}")
                return False

        except Exception as e:
            print(f"Ошибка отправки блока (соло): {e}")
            return False

# Чтение диапазона nonce
def get_nonce_range_from_file():
    try:
        with open("Txt/nonce_range.txt", "r") as file:
            line = file.readline().strip()
        min_nonce, max_nonce = map(int, line.split(","))
        return min_nonce, max_nonce
    except Exception as e:
        print(f"Ошибка чтения nonce_range.txt: {e}")
        return 3557770884, 4294967294

# Майнинг в одном процессе
def mine_chunk(args):
    chunk_start, chunk_end, prev_hash, merkle_root, timestamp, bits, target, found_block, restart_mining, hashes_processed, start_time = args
    local_hashes = 0
    last_print = time.time()
    for nonce in range(chunk_start, chunk_end + 1):
        if found_block.value or restart_mining.value:
            break
        header = create_block_header(prev_hash, merkle_root, timestamp, bits, nonce)
        block_hash = get_block_hash(header)
        local_hashes += 1
        if is_valid_hash(block_hash, target):
            found_block.value = True
            return nonce, block_hash
        if time.time() - last_print >= 1:
            hashes_processed.value += local_hashes
            elapsed = time.time() - start_time
            speed = hashes_processed.value / elapsed if elapsed > 0 else 0
            progress = (nonce - chunk_start) / (chunk_end - chunk_start) * 100
            print(f"\rNonce: {nonce:,} | Скорость: {speed:,.0f} H/s | Прогресс: {progress:.2f}%", end="")
            local_hashes = 0
            last_print = time.time()
    hashes_processed.value += local_hashes
    return None

# Основная функция майнинга
def start_mining():
    print("Запуск Bitcoin майнера")
    print(f"Время запуска: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    initial_hash = get_latest_bitcoin_hash()
    if not initial_hash:
        print("Не удалось получить начальный хеш. Завершение.")
        return
    print(f"Начальный хеш: {initial_hash}")

    manager = Manager()
    prev_hash_manager = manager.Value('s', initial_hash)
    block_height_manager = manager.Value('i', 0)
    restart_mining = manager.Value('b', False)
    found_block = manager.Value('b', False)
    hashes_processed = manager.Value('i', 0)

    monitor_proc = Process(target=monitor_new_block, args=(prev_hash_manager, block_height_manager, restart_mining))
    monitor_proc.start()

    while True:
        prev_hash = prev_hash_manager.value
        block_height = block_height_manager.value
        try:
            if block_height == 0:
                _, bits, block_height, timestamp = get_latest_block_data()
                block_height_manager.value = block_height
            else:
                timestamp = int(time.time())
                bits = get_bits()
            target = bits_to_target(bits)
            print(f"\nДанные для нового блока:")
            print(f"  Предыдущий хеш: {prev_hash}")
            print(f"  Высота блока: {block_height}")
            print(f"  Bits: {hex(bits)}")
            print(f"  Цель: {hex(target)}")
        except Exception as e:
            print(f"Ошибка получения данных: {e}")
            time.sleep(5)
            continue

        if restart_mining.value:
            print("\nПерезапуск из-за нового блока...")
            restart_mining.value = False
            continue

        transactions = get_mempool_transactions()
        print(f"\nТранзакции из мемпула: {len(transactions)}")

        coinbase_tx = create_coinbase_transaction(block_height)
        all_transactions = [coinbase_tx] + transactions
        merkle_root = compute_merkle_root(all_transactions)
        print(f"Merkle root: {merkle_root}")

        min_nonce, max_nonce = get_nonce_range_from_file()
        print(f"Диапазон nonce: {min_nonce:,} - {max_nonce:,}")
        num_cores = cpu_count()
        chunk_size = (max_nonce - min_nonce) // num_cores + 1
        args_list = [
            (
                min_nonce + i * chunk_size,
                min(min_nonce + (i + 1) * chunk_size - 1, max_nonce),
                prev_hash, merkle_root, timestamp, bits, target,
                found_block, restart_mining, hashes_processed, time.time()
            )
            for i in range(num_cores)
        ]

        try:
            with Pool(processes=num_cores) as pool:
                results = pool.imap(mine_chunk, args_list)
                for result in results:
                    if result:
                        nonce, block_hash = result
                        print(f"\nНайден валидный блок! Nonce: {nonce}, Хеш: {block_hash}")
                        header = create_block_header(prev_hash, merkle_root, timestamp, bits, nonce)
                        block_hex = assemble_block(header, coinbase_tx, transactions)
                        # Выберите режим: "pool" или "solo"
                        if submit_block(block_hex, mode="solo"):
                            print("Блок принят!")
                        else:
                            print("Блок не принят.")
                        monitor_proc.terminate()
                        return
                    if restart_mining.value:
                        break
        except Exception as e:
            print(f"\nОшибка майнинга: {e}")

        if restart_mining.value:
            print("\nПерезапуск из-за нового блока...")
            restart_mining.value = False
            continue

    monitor_proc.terminate()

if __name__ == "__main__":
    start_mining()