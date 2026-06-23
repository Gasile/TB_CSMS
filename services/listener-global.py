import pika
import json

print(" [*] Tentative de connexion à RabbitMQ...")

# 1. Connexion directe au serveur RabbitMQ de CitrineOS
credentials = pika.PlainCredentials('guest', 'guest')
parameters = pika.ConnectionParameters(host='localhost', port=5672, credentials=credentials)
connection = pika.BlockingConnection(parameters)
channel = connection.channel()

EXCHANGE_NAME = 'citrineos'

# 2. Création de la queue temporaire
result = channel.queue_declare(queue='', exclusive=True)
queue_name = result.method.queue

# 3. Liaison à l'exchange
channel.queue_bind(exchange=EXCHANGE_NAME, queue=queue_name, routing_key='#')

def callback(ch, method, properties, body):
    print(f"\n[Message] {method.routing_key}")
    print(body.decode('utf-8'))

print(' [*] Connexion réussie ! En attente de messages. Faites CTRL+C pour quitter.')

channel.basic_consume(queue=queue_name, on_message_callback=callback, auto_ack=True)
channel.start_consuming()