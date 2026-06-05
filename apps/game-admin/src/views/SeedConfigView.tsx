import { ConfigCrudView } from '../components/ConfigCrudView';
import { ConfigEditorPanel } from '../components/ConfigForm';
import { Modal } from '../components/Modal';
import { seedConfigFields } from '../domain/config';
import type { ConfigViewProps } from '../types';

export function SeedConfigView(props: ConfigViewProps): JSX.Element {
  return (
    <>
      <ConfigCrudView
        {...props}
        fields={seedConfigFields}
        idKey="seedId"
        title="灵植定义"
        useModalEditor
        columns={[
          { label: '灵植 ID', key: 'seedId' },
          { label: '名称', key: 'label' },
          { label: '稀有度', key: 'rarity' },
          { label: '排序', key: 'sortOrder' },
          { label: '成长秒', key: 'growSeconds' },
          { label: '成熟秒', key: 'matureSeconds' },
          { label: '基础产金', key: 'baseYieldGold' },
          { label: '兼容返还', key: 'harvestSeedReturn' },
        ]}
      />
      {props.isEditorOpen ? (
        <Modal
          title={props.editingId ? '编辑灵植定义' : '新增灵植定义'}
          subtitle={props.editingId || 'seed config'}
          onClose={props.onCancelEdit}
        >
          <ConfigEditorPanel
            busy={props.busy}
            fields={seedConfigFields}
            form={props.form}
            idKey="seedId"
            isEditing={Boolean(props.editingId)}
            onCancel={props.onCancelEdit}
            onFieldChange={props.onFieldChange}
            onSave={props.onSave}
          />
        </Modal>
      ) : null}
    </>
  );
}
