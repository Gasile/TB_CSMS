#!/bin/sh
# SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
#
# SPDX-License-Identifier: Apache-2.0

STATION_ID=${STATION_ID:-cp001}
_OCPP_VERSION=$OCPP_VERSION
OCPP_VERSION_ENUM="OCPP201"
EVEREST_TARGET_URL="${CSMS_URI}"

case "$_OCPP_VERSION" in
  "1.6")
    OCPP_VERSION_ENUM="OCPP16"
    ;;
  "2.0.1")
    OCPP_VERSION_ENUM="OCPP201"
    ;;
  "2.1")
    OCPP_VERSION_ENUM="OCPP21"
    ;;
  *)
    _OCPP_VERSION="2.0.1"
    OCPP_VERSION_ENUM="OCPP201"
    ;;
esac

echo $OCPP_VERSION_ENUM

if [ "$_OCPP_VERSION" != "1.6" ]; then
    CONFIG="$(cat <<JSON
[{"configurationSlot": 1, "connectionData": {"messageTimeout": 30, "ocppCsmsUrl": "$EVEREST_TARGET_URL", "ocppInterface": "Wired0", "ocppTransport": "JSON", "ocppVersion": "OCPP201", "securityProfile": 1}}]
JSON
)"

    chmod +x /tmp/config.json
    jq --argjson config "$CONFIG" '
    (.[]
        | select(.name == "InternalCtrlr")
        | .variables.NetworkConnectionProfiles.attributes.Actual
    ) = $config
    ' "/tmp/config.json" > /tmp/config_citrine.json && mv /tmp/config_citrine.json "/tmp/config.json"
    chmod -x /tmp/config.json

    # ====================================================================
    # LE VRAI CORRECTIF : Modification du Device Model (JSON)
    # ====================================================================
    # 1. URL de connexion
    chmod +x /ext/dist/share/everest/modules/OCPP201/component_config/standardized/InternalCtrlr.json
    jq --argjson config "$CONFIG" '
    (.properties.NetworkConnectionProfiles.attributes[] | select(.type == "Actual") | .value) = $config
    ' "/ext/dist/share/everest/modules/OCPP201/component_config/standardized/InternalCtrlr.json" > /tmp/ic_dist.json && mv /tmp/ic_dist.json "/ext/dist/share/everest/modules/OCPP201/component_config/standardized/InternalCtrlr.json"

    # 2. ChargePointId (L'identifiant physique de la borne)
    jq --arg id "$STATION_ID" '
    if .properties.ChargePointId then
        (.properties.ChargePointId.attributes[] | select(.type == "Actual") | .value) = $id
    else . end
    ' "/ext/dist/share/everest/modules/OCPP201/component_config/standardized/InternalCtrlr.json" > /tmp/ic_dist2.json && mv /tmp/ic_dist2.json "/ext/dist/share/everest/modules/OCPP201/component_config/standardized/InternalCtrlr.json"
    chmod -x /ext/dist/share/everest/modules/OCPP201/component_config/standardized/InternalCtrlr.json

    # 3. SecurityCtrlrIdentity (L'identifiant utilisé pour l'authentification réseau)
    SEC_CTRLR="/ext/dist/share/everest/modules/OCPP201/component_config/standardized/SecurityCtrlr.json"
    if [ -f "$SEC_CTRLR" ]; then
        chmod +x "$SEC_CTRLR"
        jq --arg id "$STATION_ID" '
        if .properties.SecurityCtrlrIdentity then
            (.properties.SecurityCtrlrIdentity.attributes[] | select(.type == "Actual") | .value) = $id
        else . end
        ' "$SEC_CTRLR" > /tmp/sec_dist.json && mv /tmp/sec_dist.json "$SEC_CTRLR"
        chmod -x "$SEC_CTRLR"
    fi
    # ====================================================================
fi

# Configuration de l'intervalle des MeterValues (ex: 10 secondes)
chmod +x /ext/dist/share/everest/modules/OCPP201/component_config/standardized/SampledDataCtrlr.json
jq '
( .properties.SampledDataTxUpdatedInterval.attributes[] 
  | select(.type == "Actual") 
  | .value
) = "10"
' "/ext/dist/share/everest/modules/OCPP201/component_config/standardized/SampledDataCtrlr.json" \
> /tmp/config_meter_dist.json && mv /tmp/config_meter_dist.json "/ext/dist/share/everest/modules/OCPP201/component_config/standardized/SampledDataCtrlr.json"
chmod -x /ext/dist/share/everest/modules/OCPP201/component_config/standardized/SampledDataCtrlr.json

/entrypoint.sh
http-server /tmp/everest_ocpp_logs -p 8888 &

if [ "$_OCPP_VERSION" = "1.6" ]; then
    chmod +x /ext/build/run-scripts/run-sil-ocpp.sh
    sed -i "0,/127.0.0.1:8180\/steve\/websocket\/CentralSystemService\// s|127.0.0.1:8180/steve/websocket/CentralSystemService/|${EVEREST_TARGET_URL}/${STATION_ID}/|" /ext/dist/share/everest/modules/OCPP/config.json
    /ext/build/run-scripts/run-sil-ocpp.sh
else
    # Configuration stable pour les versions 2.x
    rm -f /ext/dist/share/everest/modules/OCPP201/component_config/custom/EVSE_2.json
    rm -f /ext/dist/share/everest/modules/OCPP201/component_config/custom/Connector_2_1.json
    chmod +x /ext/build/run-scripts/run-sil-ocpp201-pnc.sh
    /ext/build/run-scripts/run-sil-ocpp201-pnc.sh
fi