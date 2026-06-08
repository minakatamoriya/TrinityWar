import type { AdminRaidOrderDetailResponse } from '@trinitywar/shared';
import { EmptyState } from '../components/EmptyState';
import { InfoSection } from '../components/InfoSection';
import { TableSection } from '../components/TableSection';
import { recordRows } from '../domain/labels';

export function OrderView(props: {
  busy: string;
  orderId: string;
  orderDetail: AdminRaidOrderDetailResponse | null;
  onOrderIdChange: (value: string) => void;
  onLoadOrder: () => void;
}): JSX.Element {
  return (
    <div className="view-stack">
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Order Lookup</p>
            <h3>掠夺订单查询</h3>
          </div>
          <div className="inline-form lookup-form">
            <input value={props.orderId} onChange={(event) => props.onOrderIdChange(event.target.value)} placeholder="raid order id" />
            <button className="primary-button" disabled={props.busy === 'order'} onClick={props.onLoadOrder} type="button">查询</button>
          </div>
        </div>
      </section>

      {props.orderDetail ? (
        <div className="detail-stack">
          <InfoSection
            title="订单信息"
            rows={recordRows(props.orderDetail.order, ['id', 'attackerPlayerId', 'defenderPlayerId', 'defenderFieldSlotId', 'sourceTargetPoolId', 'mode', 'status', 'requestIdempotencyKey', 'dispatchedAt', 'settleAt', 'settledAt', 'settlementVersion', 'createdAt', 'updatedAt'])}
          />
          <InfoSection
            title="结算结果"
            rows={recordRows(props.orderDetail.settlement, ['id', 'raidOrderId', 'result', 'lootGold', 'depositedGold', 'overflowGold', 'temporaryClaimExpiresAt', 'attackerLoss', 'defenderLoss', 'rewardItemsJson', 'reportSummary', 'createdAt'])}
          />
          <TableSection
            title="锁定资产"
            columns={[
              { label: '资产类型 / assetType', key: 'assetType' },
              { label: '锁定金币 / lockedGold', key: 'lockedGold' },
              { label: '模式 / lockMode', key: 'lockMode' },
              { label: '状态 / status', key: 'status' },
              { label: '来源地块 / sourceFieldSlotId', key: 'sourceFieldSlotId' },
              { label: '过期时间 / expiresAt', key: 'expiresAt' },
            ]}
            rows={props.orderDetail.assetLocks}
          />
          <TableSection
            title="战报"
            columns={[
              { label: '归属玩家 / ownerPlayerId', key: 'ownerPlayerId' },
              { label: '对手 / opponentPlayerId', key: 'opponentPlayerId' },
              { label: '类型 / reportType', key: 'reportType' },
              { label: '结果 / result', key: 'result' },
              { label: '标题 / title', key: 'title' },
              { label: '摘要 / summary', key: 'summary' },
              { label: '时间 / createdAt', key: 'createdAt' },
            ]}
            rows={props.orderDetail.reports}
          />
        </div>
      ) : (
        <section className="panel">
          <EmptyState text="输入订单 ID 后查看订单、结算、锁定资产和战报。" />
        </section>
      )}
    </div>
  );
}
