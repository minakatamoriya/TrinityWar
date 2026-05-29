import type { AdminListResponse } from '@trinitywar/shared';
import { TableSection } from '../components/TableSection';
import type { AdminRecord } from '../types';

export function ShareAssistView(props: {
  busy: string;
  campaigns: AdminListResponse<AdminRecord> | null;
  records: AdminListResponse<AdminRecord> | null;
  inviteRelations: AdminListResponse<AdminRecord> | null;
  onRefresh: () => void;
  onCampaignPageChange: (page: number) => void;
  onRecordPageChange: (page: number) => void;
  onInvitePageChange: (page: number) => void;
}): JSX.Element {
  return (
    <div className="view-stack">
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Readonly</p>
            <h3>微信助力排查</h3>
          </div>
          <button className="primary-button" disabled={props.busy === 'share-assist'} onClick={props.onRefresh} type="button">刷新</button>
        </div>
        <p className="panel-note">当前微信入口使用开发模拟参数。这里用于查看助力活动、助力人记录、邀请绑定和奖励发放状态。</p>
      </section>

      <TableSection
        title="助力活动"
        columns={[
          { label: '活动 ID / id', key: 'id' },
          { label: '发起玩家 / ownerNickname', key: 'ownerNickname' },
          { label: '玩家 ID / ownerPlayerId', key: 'ownerPlayerId' },
          { label: '类型 / campaignType', key: 'campaignType' },
          { label: '状态 / status', key: 'status' },
          { label: '进度 / currentAssistCount', key: 'currentAssistCount' },
          { label: '上限 / maxAssistCount', key: 'maxAssistCount' },
          { label: '助力记录 / recordCount', key: 'recordCount' },
          { label: '邀请绑定 / inviteCount', key: 'inviteCount' },
          { label: '过期时间 / expiresAt', key: 'expiresAt' },
          { label: '创建时间 / createdAt', key: 'createdAt' },
        ]}
        pagination={props.campaigns?.pagination}
        paginationBusy={props.busy === 'share-assist-campaigns'}
        rows={props.campaigns?.items ?? []}
        onPageChange={props.onCampaignPageChange}
      />

      <TableSection
        title="助力记录"
        columns={[
          { label: '记录 ID / id', key: 'id' },
          { label: '活动 ID / campaignId', key: 'campaignId' },
          { label: '被助力人 / ownerNickname', key: 'ownerNickname' },
          { label: '助力类型 / helperAudience', key: 'helperAudience' },
          { label: '助力玩家 / helperNickname', key: 'helperNickname' },
          { label: '助力玩家 ID / helperPlayerId', key: 'helperPlayerId' },
          { label: 'OpenID Hash / helperOpenidHash', key: 'helperOpenidHash' },
          { label: '状态 / status', key: 'status' },
          { label: '奖励时间 / rewardClaimedAt', key: 'rewardClaimedAt' },
          { label: '绑定时间 / boundAt', key: 'boundAt' },
          { label: '创建时间 / createdAt', key: 'createdAt' },
        ]}
        pagination={props.records?.pagination}
        paginationBusy={props.busy === 'share-assist-records'}
        rows={props.records?.items ?? []}
        onPageChange={props.onRecordPageChange}
      />

      <TableSection
        title="邀请绑定"
        columns={[
          { label: '关系 ID / id', key: 'id' },
          { label: '邀请人 / inviterNickname', key: 'inviterNickname' },
          { label: '邀请人 ID / inviterPlayerId', key: 'inviterPlayerId' },
          { label: '被邀请玩家 / invitedNickname', key: 'invitedNickname' },
          { label: '被邀请玩家 ID / invitedPlayerId', key: 'invitedPlayerId' },
          { label: 'OpenID Hash / invitedOpenidHash', key: 'invitedOpenidHash' },
          { label: '活动 ID / sourceCampaignId', key: 'sourceCampaignId' },
          { label: '活动状态 / campaignStatus', key: 'campaignStatus' },
          { label: '绑定状态 / status', key: 'status' },
          { label: '绑定时间 / boundAt', key: 'boundAt' },
          { label: '奖励时间 / rewardedAt', key: 'rewardedAt' },
          { label: '创建时间 / createdAt', key: 'createdAt' },
        ]}
        pagination={props.inviteRelations?.pagination}
        paginationBusy={props.busy === 'share-assist-invites'}
        rows={props.inviteRelations?.items ?? []}
        onPageChange={props.onInvitePageChange}
      />
    </div>
  );
}
