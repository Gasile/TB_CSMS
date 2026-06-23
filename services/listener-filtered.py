import pika
import json

print(" [*] Tentative de connexion a RabbitMQ...")

# 1. Connexion directe au serveur RabbitMQ de CitrineOS
credentials = pika.PlainCredentials('guest', 'guest')
parameters = pika.ConnectionParameters(host='localhost', port=5672, credentials=credentials)
connection = pika.BlockingConnection(parameters)
channel = connection.channel()

EXCHANGE_NAME = 'citrineos'

# 2. Creation de la queue temporaire
result = channel.queue_declare(queue='', exclusive=True)
queue_name = result.method.queue

# 3. Liaison a l'exchange
channel.queue_bind(exchange=EXCHANGE_NAME, queue=queue_name, routing_key='#')

def callback(ch, method, properties, body):
    try:
        data = json.loads(body.decode('utf-8'))
        
        # On ne veut ecouter que ce qui vient de la borne ("cs")
        if data.get("origin") == "csms":
            return
            
        action = data.get("action")
        payload = data.get("payload", {})
        trigger_reason = payload.get("triggerReason")
        
        # Le filtre magique corrige : on accepte Periodic ou Clock
        is_transaction_meter = (action == "TransactionEvent" and trigger_reason in ["MeterValuePeriodic", "MeterValueClock"])
        is_meter_values = (action == "MeterValues")
        
        if is_transaction_meter or is_meter_values:
            print(f"\n>>> [DONNEES MESUREES RECUES - {trigger_reason}] <<<")
            print(json.dumps(data, indent=2))
            print("-" * 50)
            
    except json.JSONDecodeError:
        pass

print(' [*] Connexion reussie ! Filtre active.')
print(' [*] En attente exclusive des MeterValues (Periodic ou Clock)... Faites CTRL+C pour quitter.')

channel.basic_consume(queue=queue_name, on_message_callback=callback, auto_ack=True)
channel.start_consuming()