from bitcoinrpc.authproxy import AuthServiceProxy

def bits_to_target(bits_hex: str) -> int:
    bits = bytes.fromhex(bits_hex)
    exponent = bits[0]
    mantissa = int.from_bytes(bits[1:], 'big')
    return mantissa * (1 << (8 * (exponent - 3)))

def target_to_bits(target: int) -> str:
    exponent = (target.bit_length() + 7) // 8
    mantissa = target >> (8 * (exponent - 3))
    return f"{exponent:02x}{mantissa:06x}"

rpc_user = "bitcoinrpc"
rpc_password = "Lisnevskyi2005!"
rpc_port = 8332  # Для mainnet, для regtest: 18443

rpc_connection = AuthServiceProxy(f"http://{rpc_user}:{rpc_password}@127.0.0.1:{rpc_port}")

latest_block = rpc_connection.getblock(rpc_connection.getbestblockhash())
current_bits = latest_block['bits']
current_target = bits_to_target(current_bits)

#  Добавляем проверку на корректность данных
if current_bits:
    new_bits = current_bits  # Упрощённо оставляем без изменений
    new_target = bits_to_target(new_bits)

    print(" Параметры следующего успешного блока:")
    print(f"  🔹 bits       = {new_bits}")
    print(f"  🔹 target     = {hex(new_target)}")
else:
    print(" Ошибка: Не удалось получить 'bits' из последнего блока.")


# RUN IN CMD 
# cd "C:\Program Files\Bitcoin\daemon\"
# .\bitcoind.exe
