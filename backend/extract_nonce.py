def extract_nonce_from_hashes(input_file="Txt/hashes.txt", output_file="Txt/nonces.txt"):
    with open(input_file, "r") as infile, open(output_file, "w") as outfile:
        for line in infile:
            hash_hex = line.strip()
            if len(hash_hex) == 64:  # Проверяем, что это полный хеш (256 бит)
                nonce_hex = hash_hex[-8:]  # Берем последние 8 символов
                nonce = int(nonce_hex, 16)  # Переводим из HEX в число
                outfile.write(f"{nonce}\n")

    print(f"Nonce успешно извлечены и сохранены в {output_file}")

# Запуск функции с указанием пути
extract_nonce_from_hashes("Txt/hashes.txt", "Txt/nonces.txt")
