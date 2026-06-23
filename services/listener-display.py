import pika
import json
import sys

# Notre "Base de donnees" simulee en memoire
mock_influx_db = []

def callback(ch, method, properties, body):
    global mock_influx_db
    
    try:
        data = json.loads(body.decode('utf-8'))
        
        # 1. Ignorer les reponses du serveur (csms), on ne veut ecouter que la borne (cs)
        if data.get("origin") != "cs":
            return
            
        # 2. Filtrer uniquement les evenements de transaction
        if data.get("action") == "TransactionEvent":
            payload = data.get("payload", {})
            trigger_reason = payload.get("triggerReason")
            
            # 3. Cibler specifiquement les envois de compteurs (Clock ou Periodic)
            if trigger_reason in ["MeterValuePeriodic", "MeterValueClock"]:
                
                # Extraction des metadonnees
                timestamp = payload.get("timestamp")
                transaction_id = payload.get("transactionInfo", {}).get("transactionId")
                
                energy_wh = None
                voltage = None
                power_w = None
                
                # 4. Parcourir le tableau des valeurs mesurees
                meter_values = payload.get("meterValue", [])
                if meter_values:
                    sampled_values = meter_values[0].get("sampledValue", [])
                    
                    for sample in sampled_values:
                        measurand = sample.get("measurand")
                        
                        # On recupere l'energie totale (on exclut les phases L1, L2, L3)
                        if measurand == "Energy.Active.Import.Register" and "phase" not in sample:
                            energy_wh = sample.get("value")
                            
                        # On recupere la tension globale
                        elif measurand == "Voltage" and "phase" not in sample:
                            voltage = sample.get("value")
                            
                        # On recupere la puissance globale en Watts (tres utile pour ton Dashboard)
                        elif measurand == "Power.Active.Import" and "phase" not in sample:
                            power_w = sample.get("value")
                
                # 5. Si on a trouve des donnees, on "sauvegarde" dans InfluxDB
                if energy_wh is not None or power_w is not None:
                    # Creation du "Point" InfluxDB
                    point = {
                        "time": timestamp,
                        "transaction_id": transaction_id,
                        "energy_wh": energy_wh,
                        "power_w": power_w,
                        "voltage_v": voltage
                    }
                    
                    # Insertion dans notre DB simulee
                    mock_influx_db.append(point)
                    
                    # Affichage console pour valider le fonctionnement (sans accents ni emojis)
                    print("\n" + "="*50)
                    print(">>> NOUVEAU POINT EXTRAIT ET SAUVEGARDE <<<")
                    print(json.dumps(point, indent=2))
                    print(f">>> Taille de la DB simulee : {len(mock_influx_db)} enregistrement(s)")
                    print("="*50)

    except Exception as e:
        print(f"\n[Erreur de parsing] {e}")

def main():
    print(" [*] Tentative de connexion a RabbitMQ...")
    
    try:
        credentials = pika.PlainCredentials('guest', 'guest')
        parameters = pika.ConnectionParameters(host='localhost', port=5672, credentials=credentials)
        connection = pika.BlockingConnection(parameters)
        channel = connection.channel()
    except Exception as e:
        print(f" Erreur de connexion au Broker : {e}")
        return

    EXCHANGE_NAME = 'citrineos'
    
    result = channel.queue_declare(queue='', exclusive=True)
    queue_name = result.method.queue
    channel.queue_bind(exchange=EXCHANGE_NAME, queue=queue_name, routing_key='#')

    print(' [*] Connexion reussie ! En attente des MeterValues. Faites CTRL+C pour quitter.')

    channel.basic_consume(queue=queue_name, on_message_callback=callback, auto_ack=True)
    
    try:
        channel.start_consuming()
    except KeyboardInterrupt:
        print('\n Arret de l\'ecoute. Voici le contenu final de la DB simulee :')
        print(json.dumps(mock_influx_db, indent=2))
        connection.close()

if __name__ == '__main__':
    main()